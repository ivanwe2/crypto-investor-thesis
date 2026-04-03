package exchange

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const baseURL = "wss://stream.binance.com:9443/stream?streams="

// Thesis Angle 15: Subscription Idempotency
type SubscriptionManager struct {
	mu        sync.RWMutex
	active    map[string]bool
	subChan   chan string
	unsubChan chan string
}

var SubManager = &SubscriptionManager{
	active:    make(map[string]bool),
	subChan:   make(chan string, 1000),
	unsubChan: make(chan string, 1000),
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

// Unsubscribe returns true if the symbol was active and is now removed
func (sm *SubscriptionManager) Unsubscribe(symbol string) bool {
	sym := strings.ToLower(symbol)

	sm.mu.Lock()
	defer sm.mu.Unlock()

	if !sm.active[sym] {
		return false
	}

	delete(sm.active, sym)
	sm.unsubChan <- sym
	return true
}

// Thread-safe pre-warming — adds initial symbols without triggering the dynamic subChan
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
	}

	// Thread-safe pre-warming under the mutex (fixes data race with concurrent Subscribe() calls)
	SubManager.PreWarm(symbols)

	url := baseURL + strings.Join(streamParams, "/")

	slog.Info("Connecting to Binance", "url", url)

	c, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		slog.Error("Binance connection failed", "error", err)
		return
	}
	defer c.Close()

	slog.Info("Connected to Binance, streaming to channel")

	// Background WRITER thread for dynamic subscriptions
	// Gorilla WebSocket supports one concurrent reader and one concurrent writer
	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case sym := <-SubManager.subChan:
				msg := map[string]interface{}{
					"method": "SUBSCRIBE",
					"params": []string{sym + "@trade"},
					"id":     time.Now().UnixMilli(),
				}
				if err := c.WriteJSON(msg); err != nil {
					slog.Error("Failed to send SUBSCRIBE", "symbol", sym, "error", err)
				} else {
					slog.Info("Dynamically subscribed to new market", "symbol", sym)
				}
			case sym := <-SubManager.unsubChan:
				msg := map[string]interface{}{
					"method": "UNSUBSCRIBE",
					"params": []string{sym + "@trade"},
					"id":     time.Now().UnixMilli(),
				}
				if err := c.WriteJSON(msg); err != nil {
					slog.Error("Failed to send UNSUBSCRIBE", "symbol", sym, "error", err)
				} else {
					slog.Info("Dynamically unsubscribed from market", "symbol", sym)
				}
			}
		}
	}()

	go func() {
		<-ctx.Done()
		slog.Info("Application shutdown detected, closing Binance WebSocket")
		c.Close()
	}()

	for {
		_, message, err := c.ReadMessage()
		if err != nil {
			if ctx.Err() != nil {
				slog.Info("Binance WebSocket read loop terminated gracefully")
				return
			}
			slog.Warn("Binance WebSocket read error", "error", err)
			time.Sleep(2 * time.Second)
			continue
		}

		var event CombinedStreamEvent
		if err := json.Unmarshal(message, &event); err != nil {
			slog.Warn("Failed to parse Binance message", "error", err)
			continue
		}

		select {
		case dataChan <- event:
		default:
			slog.Warn("Channel full, dropping message")
		}
	}
}
