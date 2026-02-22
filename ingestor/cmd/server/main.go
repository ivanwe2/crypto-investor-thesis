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
)

func main() {
	log.Println("[INFO] Crypto Ingestor Starting...")

	// 1. Load Configuration
	cfg := config.Load()

	// 2. Initialize RabbitMQ
	publisher, err := messaging.NewRabbitMQClient(cfg.RabbitMQURL)
	if err != nil {
		log.Fatalf("[FATAL] Failed to connect to RabbitMQ: %v", err)
	}
	defer publisher.Close()
	log.Println("[INFO] RabbitMQ Publisher Ready")

	// 3. Setup and Start Health Check Server
	httpServer := health.NewServer(cfg.HealthPort)
	go func() {
		log.Printf("[INFO] Health check server listening on %s/healthz\n", cfg.HealthPort)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[FATAL] HTTP server error: %v", err)
		}
	}()

	// 4. Setup Data Channel & Start Ingestion
	tradesChan := make(chan exchange.CombinedStreamEvent, 100)
	go exchange.Connect(cfg.Symbols, tradesChan)

	// 5. Setup Graceful Shutdown Listener
	stopChan := make(chan os.Signal, 1)
	signal.Notify(stopChan, os.Interrupt, syscall.SIGTERM)

	log.Println("[INFO] Forwarding trades to RabbitMQ...")

	// 6. Main Event Loop
	for {
		select {
		case trade := <-tradesChan:
			err := publisher.Publish(trade)
			if err != nil {
				log.Printf("[ERROR] Failed to publish: %v", err)
			} else {
				log.Printf("[DEBUG] Sent -> %s: %s", trade.Data.Symbol, trade.Data.Price)
			}

		case sig := <-stopChan:
			log.Printf("[INFO] Received shutdown signal: %v. Initiating graceful shutdown...", sig)

			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()

			if err := httpServer.Shutdown(ctx); err != nil {
				log.Printf("[WARN] HTTP server shutdown error: %v", err)
			}

			log.Println("[INFO] Graceful shutdown complete. Goodbye!")
			return
		}
	}
}
