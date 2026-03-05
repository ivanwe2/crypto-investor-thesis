package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"ingestor/internal/config"
	"ingestor/internal/exchange"
	"ingestor/internal/health"
	"ingestor/internal/messaging"
	"ingestor/internal/telemetry"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
)

func main() {
	log.Println("[INFO] Crypto Ingestor Starting...")

	// 1. Load Configuration
	cfg := config.Load()

	// ✨ 2. Initialize OpenTelemetry
	// We point this to the OTEL Collector container port 4317
	otelShutdown, err := telemetry.InitProvider("TradeIngestor", "otel-collector:4317")
	if err != nil {
		log.Fatalf("[FATAL] Failed to initialize OpenTelemetry: %v", err)
	}

	// 3. Initialize RabbitMQ
	publisher, err := messaging.NewRabbitMQClient(cfg.RabbitMQURL)
	if err != nil {
		log.Fatalf("[FATAL] Failed to connect to RabbitMQ: %v", err)
	}
	defer publisher.Close()
	log.Println("[INFO] RabbitMQ Publisher Ready")

	// 4. Setup and Start Health Check Server
	httpServer := health.NewServer(cfg.HealthPort)
	go func() {
		log.Printf("[INFO] Health check server listening on %s/healthz\n", cfg.HealthPort)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[FATAL] HTTP server error: %v", err)
		}
	}()

	// 5. Setup Data Channel & Start Ingestion
	tradesChan := make(chan exchange.CombinedStreamEvent, 100)
	go exchange.Connect(cfg.Symbols, tradesChan)

	// 6. Setup Graceful Shutdown Listener
	stopChan := make(chan os.Signal, 1)
	signal.Notify(stopChan, os.Interrupt, syscall.SIGTERM)

	log.Println("[INFO] Forwarding trades to RabbitMQ...")

	// 7. Main Event Loop
	for {
		select {
		case trade := <-tradesChan:
			// ✨ START THE DISTRIBUTED TRACE ✨
			// We create a root span here. This is the exact moment the trade enters our system.
			tr := otel.Tracer("ingestor")
			ctx, span := tr.Start(context.Background(), "Ingest Binance Trade")

			// Add useful metadata to the trace so you can search for it in Grafana
			span.SetAttributes(
				attribute.String("crypto.symbol", trade.Data.Symbol),
				attribute.String("crypto.price", trade.Data.Price),
			)

			// ✨ Pass the trace context into the publisher
			err := publisher.Publish(ctx, trade)
			if err != nil {
				log.Printf("[ERROR] Failed to publish: %v", err)
			} else {
				log.Printf("[DEBUG] Sent -> %s: %s", trade.Data.Symbol, trade.Data.Price)
			}

			// End the span
			span.End()

		case sig := <-stopChan:
			log.Printf("[INFO] Received shutdown signal: %v. Initiating graceful shutdown...", sig)

			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()

			if err := httpServer.Shutdown(ctx); err != nil {
				log.Printf("[WARN] HTTP server shutdown error: %v", err)
			}

			// ✨ Flush all remaining traces before exiting
			if err := otelShutdown(ctx); err != nil {
				log.Printf("[WARN] OTEL shutdown error: %v", err)
			}

			log.Println("[INFO] Graceful shutdown complete. Goodbye!")
			return
		}
	}
}
