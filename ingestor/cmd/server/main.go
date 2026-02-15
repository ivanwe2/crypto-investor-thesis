package main

import (
	"ingestor/internal/exchange"
	"ingestor/internal/messaging"
	"log"
	"os"
)

func main() {
	log.Println("Crypto Ingestor Starting...")

	rabbitURL := os.Getenv("RABBITMQ_URL")
	if rabbitURL == "" {
		rabbitURL = "amqp://user:password@localhost:5672/"
	}

	publisher, err := messaging.NewRabbitMQClient(rabbitURL)
	if err != nil {
		log.Fatalf("Failed to connect to RabbitMQ: %v", err)
	}
	defer publisher.Close()
	log.Println("RabbitMQ Publisher Ready")

	// Buffer of 100 messages allows for small bursts of traffic
	tradesChan := make(chan exchange.CombinedStreamEvent, 100)

	// 3. Start Ingestion in a Goroutine (Background thread)
	symbols := []string{"btcusdt", "ethusdt", "solusdt"}
	go exchange.Connect(symbols, tradesChan)

	// 4. Main Loop: Read from Channel -> Publish to RabbitMQ
	log.Println("Forwarding trades to RabbitMQ...")
	for trade := range tradesChan {
		err := publisher.Publish(trade)
		if err != nil {
			log.Printf("Failed to publish: %v", err)
		} else {
			// Print to console so we know it's working
			log.Printf("Sent -> %s: %s", trade.Data.Symbol, trade.Data.Price)
		}
	}
}
