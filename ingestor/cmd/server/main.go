package main

import (
	"context"
	"log"
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
)

// ✨ NEW: Debouncer state to prevent log spam
var (
	lastAlertTime = make(map[string]time.Time)
	alertMutex    sync.Mutex
)

func main() {
	log.Println("[INFO] Crypto Ingestor Starting...")

	appCtx, appCancel := context.WithCancel(context.Background())
	defer appCancel()

	cfg := config.Load()

	otelShutdown, err := telemetry.InitProvider("TradeIngestor", "otel-collector:4317")
	if err != nil {
		log.Fatalf("[FATAL] Failed to initialize OpenTelemetry: %v", err)
	}

	publisher, err := messaging.NewRabbitMQClient(cfg.RabbitMQURL)
	if err != nil {
		log.Fatalf("[FATAL] Failed to connect to RabbitMQ: %v", err)
	}
	defer publisher.Close()
	log.Println("[INFO] RabbitMQ Publisher Ready")

	// ✨ Initialize our new high-performance memory structures
	marketCache := cache.NewMarketCache()
	volTracker := analytics.NewVolatilityTracker()

	grpcServer := grpc.StartServer(":50051", marketCache)

	httpServer := health.NewServer(cfg.HealthPort)
	go func() {
		log.Printf("[INFO] Health check server listening on %s/healthz\n", cfg.HealthPort)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[FATAL] HTTP server error: %v", err)
		}
	}()

	tradesChan := make(chan exchange.CombinedStreamEvent, 10000)
	go exchange.Connect(appCtx, cfg.Symbols, tradesChan)

	stopChan := make(chan os.Signal, 1)
	signal.Notify(stopChan, os.Interrupt, syscall.SIGTERM)

	log.Println("[INFO] Forwarding trades to RabbitMQ and updating Cache...")

	for {
		select {
		case trade := <-tradesChan:
			tr := otel.Tracer("ingestor")
			ctx, span := tr.Start(context.Background(), "Ingest Binance Trade")

			span.SetAttributes(
				attribute.String("crypto.symbol", trade.Data.Symbol),
				attribute.String("crypto.price", trade.Data.Price),
			)

			// ✨ Parse price and update Intelligence/Cache layers
			priceFloat, parseErr := strconv.ParseFloat(trade.Data.Price, 64)
			if parseErr == nil {
				volatility := volTracker.ProcessTick(trade.Data.Symbol, priceFloat)
				marketCache.UpdatePrice(trade.Data.Symbol, priceFloat, volatility)

				// ✨ FIX 2: The Debouncer
				if volatility > 5.0 {
					alertMutex.Lock()
					lastTime, exists := lastAlertTime[trade.Data.Symbol]

					// Only alert if we haven't alerted for this coin in the last 5 seconds
					if !exists || time.Since(lastTime) > 5*time.Second {
						log.Printf("🚨 [ALERT] High volatility detected on %s: %.2f", trade.Data.Symbol, volatility)
						lastAlertTime[trade.Data.Symbol] = time.Now()
					}
					alertMutex.Unlock()
				}
			} else {
				log.Printf("[WARN] Failed to parse price for %s: %v", trade.Data.Symbol, parseErr)
			}

			// Pass the trace context into the publisher
			err := publisher.Publish(ctx, trade)
			if err != nil {
				log.Printf("[ERROR] Failed to publish: %v", err)
			}

			span.End()

		case sig := <-stopChan:
			log.Printf("[INFO] Received shutdown signal: %v. Initiating graceful shutdown...", sig)

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
				log.Println("[INFO] Stopping gRPC Server gracefully (flushing streams)...")
				grpcServer.GracefulStop() // Waits for active RPCs to finish
				log.Println("[INFO] gRPC Server stopped.")
			}()

			wg.Add(1)
			go func() {
				defer wg.Done()
				log.Println("[INFO] Stopping HTTP Health Server...")
				if err := httpServer.Shutdown(shutdownCtx); err != nil {
					log.Printf("[WARN] HTTP server shutdown error: %v", err)
				}
				log.Println("[INFO] HTTP Health Server stopped.")
			}()

			// Wait for networking layers to finish shutting down
			wg.Wait()

			// 4. Finally, flush remaining OpenTelemetry logs before the process dies
			log.Println("[INFO] Flushing OpenTelemetry traces...")
			if err := otelShutdown(shutdownCtx); err != nil {
				log.Printf("[WARN] OTEL shutdown error: %v", err)
			}

			log.Println("[INFO] Graceful shutdown complete. Goodbye!")
			return
		}
	}
}
