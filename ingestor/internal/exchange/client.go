package exchange

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/gorilla/websocket"
)

const baseURL = "wss://stream.binance.com:9443/stream?streams="

// ✨ CHANGED: Injected context.Context to listen for shutdown signals
func Connect(ctx context.Context, symbols []string, dataChan chan<- CombinedStreamEvent) {
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

	// ✨ NEW: Background listener for shutdown context
	// The easiest way to break a blocking websocket ReadMessage() is to close the connection
	go func() {
		<-ctx.Done()
		log.Println("[INFO] Application shutdown detected. Closing Binance WebSocket...")
		c.Close() // This will force c.ReadMessage() below to return an error instantly
	}()

	for {
		_, message, err := c.ReadMessage()
		if err != nil {
			// Check if this error was caused by our deliberate graceful shutdown
			if ctx.Err() != nil {
				log.Println("[INFO] Binance WebSocket read loop terminated gracefully.")
				return
			}
			log.Println("[WARN] Read error:", err)
			time.Sleep(2 * time.Second)
			continue
		}

		var event CombinedStreamEvent
		if err := json.Unmarshal(message, &event); err != nil {
			log.Println("Parse error:", err)
			continue
		}

		select {
		case dataChan <- event:
		default:
			log.Println("⚠️ Channel full, dropping message")
		}
	}
}
