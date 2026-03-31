package exchange

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const baseURL = "wss://stream.binance.com:9443/stream?streams="

// ✨ Thesis Angle 15: Subscription Idempotency
type SubscriptionManager struct {
	mu      sync.RWMutex
	active  map[string]bool
	subChan chan string
}

var SubManager = &SubscriptionManager{
	active:  make(map[string]bool),
	subChan: make(chan string, 1000), // Buffered channel for dynamic requests
}

// Subscribe returns true if it's a NEW subscription, false if it's already active O(1)
func (sm *SubscriptionManager) Subscribe(symbol string) bool {
	sym := strings.ToLower(symbol)

	sm.mu.Lock()
	defer sm.mu.Unlock()

	if sm.active[sym] {
		return false
	}

	sm.active[sym] = true
	sm.subChan <- sym
	return true
}

// ✨ FIX 1.3: Thread-safe pre-warming
// PreWarm safely adds initial symbols without triggering the dynamic subChan
func (sm *SubscriptionManager) PreWarm(symbols []string) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	for _, s := range symbols {
		sm.active[strings.ToLower(s)] = true
	}
}

func Connect(ctx context.Context, symbols []string, dataChan chan<- CombinedStreamEvent) {
	streamParams := make([]string, len(symbols))
	for i, s := range symbols {
		streamParams[i] = fmt.Sprintf("%s@trade", strings.ToLower(s))
		// Pre-warm the idempotency map with our initial symbols
		SubManager.active[strings.ToLower(s)] = true
	}

	SubManager.PreWarm(symbols)

	url := baseURL + strings.Join(streamParams, "/")

	log.Printf("Connecting to Binance: %s", url)

	c, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		log.Fatal("Connection failed:", err)
	}
	defer c.Close()

	log.Println("Connected! Streaming to channel...")

	// ✨ NEW: Background WRITER thread for dynamic subscriptions
	// Gorilla WebSocket supports one concurrent reader and one concurrent writer
	go func() {
		for {
			select {
			case <-ctx.Done():
				return // Exit goroutine on shutdown
			case sym := <-SubManager.subChan:
				msg := map[string]interface{}{
					"method": "SUBSCRIBE",
					"params": []string{sym + "@trade"},
					"id":     time.Now().UnixMilli(),
				}
				if err := c.WriteJSON(msg); err != nil {
					log.Printf("[ERROR] Failed to send SUBSCRIBE for %s: %v", sym, err)
				} else {
					log.Printf("📡 Dynamically Subscribed to new market: %s", sym)
				}
			}
		}
	}()

	go func() {
		<-ctx.Done()
		log.Println("[INFO] Application shutdown detected. Closing Binance WebSocket...")
		c.Close()
	}()

	for {
		_, message, err := c.ReadMessage()
		if err != nil {
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
