package exchange

import (
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/gorilla/websocket"
)

const baseURL = "wss://stream.binance.com:9443/stream?streams="

func Connect(symbols []string, dataChan chan<- CombinedStreamEvent) {
	streamParams := make([]string, len(symbols))
	for i, s := range symbols {
		streamParams[i] = fmt.Sprintf("%s@trade", strings.ToLower(s))
	}
	url := baseURL + strings.Join(streamParams, "/")

	log.Printf("Connecting to Binance: %s", url)

	c, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		log.Fatal("Connection failed:", err)
	}
	defer c.Close()

	log.Println("Connected! Streaming to channel...")

	for {
		_, message, err := c.ReadMessage()
		if err != nil {
			log.Println("Read error:", err)
			time.Sleep(2 * time.Second)
			continue
		}

		var event CombinedStreamEvent
		if err := json.Unmarshal(message, &event); err != nil {
			log.Println("Parse error:", err)
			continue
		}

		// Non-blocking send: If the channel is full, we drop the message.
		// This prevents the WebSocket from disconnecting if RabbitMQ gets slow.
		select {
		case dataChan <- event:
		default:
			log.Println("⚠️ Channel full, dropping message")
		}
	}
}
