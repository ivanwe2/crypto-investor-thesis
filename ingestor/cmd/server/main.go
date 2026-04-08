package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"sync"
	"syscall"
	"time"

	"ingestor/internal/analytics"
	"ingestor/internal/cache"
	"ingestor/internal/config"
	"ingestor/internal/exchange"
	"ingestor/internal/grpc"
	"ingestor/internal/health"
	"ingestor/internal/messaging"
	"ingestor/internal/telemetry"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"
)

type AlertDebouncer struct {
	mu       sync.Mutex
	lastSent map[string]time.Time
	ttl      time.Duration
}

func NewAlertDebouncer(ttl time.Duration, cleanupInterval time.Duration) *AlertDebouncer {
	ad := &AlertDebouncer{
		lastSent: make(map[string]time.Time),
		ttl:      ttl,
	}
	go ad.cleanupLoop(cleanupInterval)
	return ad
}

func (ad *AlertDebouncer) cleanupLoop(interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for range ticker.C {
		ad.mu.Lock()
		now := time.Now()
		for symbol, timestamp := range ad.lastSent {
			if now.Sub(timestamp) > ad.ttl {
				delete(ad.lastSent, symbol) // Free up memory
			}
		}
		ad.mu.Unlock()
	}
}

func (ad *AlertDebouncer) ShouldAlert(symbol string) bool {
	ad.mu.Lock()
	defer ad.mu.Unlock()
	now := time.Now()
	if last, exists := ad.lastSent[symbol]; exists {
		if now.Sub(last) < ad.ttl {
			return false // Too soon to alert again
		}
	}
	ad.lastSent[symbol] = now
	return true
}

func main() {
	slog.Info("Crypto Ingestor Starting")

	appCtx, appCancel := context.WithCancel(context.Background())
	defer appCancel()

	cfg := config.Load()

	meterProvider, otelShutdown, err := telemetry.InitProvider("TradeIngestor", "otel-collector:4317")
	if err != nil {
		slog.Error("Failed to initialize OpenTelemetry", "error", err)
		os.Exit(1)
	}

	// Initialize custom business metrics
	metrics, err := telemetry.NewMetrics(meterProvider)
	if err != nil {
		slog.Error("Failed to initialize metrics", "error", err)
		os.Exit(1)
	}

	// Record initial subscriptions
	metrics.ActiveSubscriptions.Add(appCtx, int64(len(cfg.Symbols)))

	publisher, err := messaging.NewRabbitMQClient(cfg.RabbitMQURL)
	if err != nil {
		slog.Error("Failed to connect to RabbitMQ", "error", err)
		os.Exit(1)
	}
	defer publisher.Close()
	slog.Info("RabbitMQ Publisher Ready")

	// Initialize high-performance memory structures
	marketCache := cache.NewMarketCache()
	volTracker := analytics.NewVolatilityTracker()

	// Initialize debouncer: 5 seconds cooldown per alert, 10 min memory cleanup sweep
	debouncer := NewAlertDebouncer(5*time.Second, 10*time.Minute)

	grpcServer := grpc.StartServer(":50051", marketCache, metrics)

	// Background order book refresh: proactively warms the cache every 3s for all subscribed
	// symbols so that GetOrderBookDepth gRPC calls always hit the cache (eliminates ~270ms
	// Binance REST round-trips from the hot request path).
	go func() {
		ticker := time.NewTicker(3 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-appCtx.Done():
				return
			case <-ticker.C:
				for _, sym := range exchange.SubManager.ActiveSymbols() {
					depthData, err := exchange.FetchOrderBookDepth(appCtx, sym, 20)
					if err != nil {
						slog.Warn("Background order book refresh failed", "symbol", sym, "error", err)
						continue
					}
					bids := make([]cache.OrderBookEntry, len(depthData.Bids))
					for i, b := range depthData.Bids {
						bids[i] = cache.OrderBookEntry{Price: b.Price, Size: b.Size}
					}
					asks := make([]cache.OrderBookEntry, len(depthData.Asks))
					for i, a := range depthData.Asks {
						asks[i] = cache.OrderBookEntry{Price: a.Price, Size: a.Size}
					}
					marketCache.UpdateOrderBook(sym, depthData.LastUpdateID, bids, asks)
				}
			}
		}
	}()

	httpServer := health.NewServer(cfg.HealthPort)
	go func() {
		slog.Info("Health check server listening", "port", cfg.HealthPort)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("HTTP server error", "error", err)
			os.Exit(1)
		}
	}()

	tradesChan := make(chan exchange.CombinedStreamEvent, 10000)
	go exchange.Connect(appCtx, cfg.Symbols, tradesChan, metrics.MessagesDropped)

	stopChan := make(chan os.Signal, 1)
	signal.Notify(stopChan, os.Interrupt, syscall.SIGTERM)

	slog.Info("Forwarding trades to RabbitMQ and updating Cache")

	for {
		select {
		case trade := <-tradesChan:
			tr := otel.Tracer("ingestor")
			ctx, span := tr.Start(context.Background(), "Ingest Binance Trade")

			span.SetAttributes(
				attribute.String("crypto.symbol", trade.Data.Symbol),
				attribute.String("crypto.price", trade.Data.Price),
			)

			// Parse price and update Intelligence/Cache layers
			priceFloat, parseErr := strconv.ParseFloat(trade.Data.Price, 64)
			if parseErr == nil {
				volatility := volTracker.ProcessTick(trade.Data.Symbol, priceFloat)
				marketCache.UpdatePrice(trade.Data.Symbol, priceFloat, volatility)

				if volatility > 5.0 {
					if debouncer.ShouldAlert(trade.Data.Symbol) {
						slog.Warn("High volatility detected", "symbol", trade.Data.Symbol, "volatility", volatility)
					}
				}
			} else {
				slog.Warn("Failed to parse price", "symbol", trade.Data.Symbol, "error", parseErr)
			}

			// Record trade ingested metric
			metrics.TradesIngested.Add(ctx, 1, metric.WithAttributes(
				attribute.String("symbol", trade.Data.Symbol),
			))

			// Pass the trace context into the publisher
			err := publisher.Publish(ctx, trade)
			if err != nil {
				slog.Error("Failed to publish trade", "error", err)
			}

			span.End()

		case sig := <-stopChan:
			slog.Info("Received shutdown signal, initiating graceful shutdown", "signal", sig.String())

			// 1. Signal the Binance WebSocket to close and stop sending new trades
			appCancel()

			// 2. Create a timeout context so we don't hang forever if a connection is stuck
			shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer shutdownCancel()

			// 3. Use WaitGroup to shut down HTTP and gRPC simultaneously
			var wg sync.WaitGroup

			wg.Add(1)
			go func() {
				defer wg.Done()
				slog.Info("Stopping gRPC Server gracefully (flushing streams)")
				grpcServer.GracefulStop()
				slog.Info("gRPC Server stopped")
			}()

			wg.Add(1)
			go func() {
				defer wg.Done()
				slog.Info("Stopping HTTP Health Server")
				if err := httpServer.Shutdown(shutdownCtx); err != nil {
					slog.Warn("HTTP server shutdown error", "error", err)
				}
				slog.Info("HTTP Health Server stopped")
			}()

			// Wait for networking layers to finish shutting down
			wg.Wait()

			// 4. Finally, flush remaining OpenTelemetry data before the process dies
			slog.Info("Flushing OpenTelemetry traces, metrics, and logs")
			if err := otelShutdown(shutdownCtx); err != nil {
				slog.Warn("OTel shutdown error", "error", err)
			}

			slog.Info("Graceful shutdown complete")
			return
		}
	}
}
