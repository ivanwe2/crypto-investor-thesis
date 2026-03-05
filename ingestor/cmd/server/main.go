package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
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

func main() {
	log.Println("[INFO] Crypto Ingestor Starting...")

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

	go grpc.StartServer(":50051", marketCache)

	httpServer := health.NewServer(cfg.HealthPort)
	go func() {
		log.Printf("[INFO] Health check server listening on %s/healthz\n", cfg.HealthPort)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[FATAL] HTTP server error: %v", err)
		}
	}()

	tradesChan := make(chan exchange.CombinedStreamEvent, 100)
	go exchange.Connect(cfg.Symbols, tradesChan)

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
				// 1. Calculate running volatility
				volatility := volTracker.ProcessTick(trade.Data.Symbol, priceFloat)

				// 2. Safely write to our RWMutex cache
				marketCache.UpdatePrice(trade.Data.Symbol, priceFloat, volatility)

				// (Optional) Log highly volatile moments!
				if volatility > 5.0 {
					log.Printf("[ALERT] High volatility detected on %s: %.2f", trade.Data.Symbol, volatility)
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

			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()

			if err := httpServer.Shutdown(ctx); err != nil {
				log.Printf("[WARN] HTTP server shutdown error: %v", err)
			}

			if err := otelShutdown(ctx); err != nil {
				log.Printf("[WARN] OTEL shutdown error: %v", err)
			}

			log.Println("[INFO] Graceful shutdown complete. Goodbye!")
			return
		}
	}
}
