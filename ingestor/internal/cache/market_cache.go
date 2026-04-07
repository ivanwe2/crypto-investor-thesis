package cache

import (
	"sync"
	"time"
)

// MarketSnapshot represents the current state of an asset
type MarketSnapshot struct {
	Symbol     string  `json:"symbol"`
	Price      float64 `json:"price"`
	Volatility float64 `json:"volatility"`
	Timestamp  int64   `json:"timestamp_utc"`
}

// OrderBookEntry is a single price level in the order book
type OrderBookEntry struct {
	Price float64
	Size  float64
}

// OrderBookSnapshot is the cached L2 depth for a symbol
type OrderBookSnapshot struct {
	LastUpdateID int64
	Bids         []OrderBookEntry
	Asks         []OrderBookEntry
	FetchedAt    time.Time
}

type MarketCache struct {
	mu         sync.RWMutex
	data       map[string]*MarketSnapshot
	orderBooks map[string]*OrderBookSnapshot
}

func NewMarketCache() *MarketCache {
	return &MarketCache{
		data:       make(map[string]*MarketSnapshot),
		orderBooks: make(map[string]*OrderBookSnapshot),
	}
}

// UpdatePrice updates the cache safely and returns the updated snapshot
func (c *MarketCache) UpdatePrice(symbol string, price float64, volatility float64) *MarketSnapshot {
	c.mu.Lock()
	defer c.mu.Unlock()

	snap := &MarketSnapshot{
		Symbol:     symbol,
		Price:      price,
		Volatility: volatility,
		Timestamp:  time.Now().UnixMilli(),
	}
	c.data[symbol] = snap
	return snap
}

// GetSnapshot safely reads a snapshot
func (c *MarketCache) GetSnapshot(symbol string) (*MarketSnapshot, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	snap, exists := c.data[symbol]
	return snap, exists
}

// GetAll returns a copy of all current snapshots
func (c *MarketCache) GetAll() map[string]*MarketSnapshot {
	c.mu.RLock()
	defer c.mu.RUnlock()

	copyMap := make(map[string]*MarketSnapshot)
	for k, v := range c.data {
		// Shallow copy the snapshot pointer is fine here since we replace the whole struct on update
		copyMap[k] = v
	}
	return copyMap
}

// UpdateOrderBook stores a fresh order book snapshot for the given symbol.
func (c *MarketCache) UpdateOrderBook(symbol string, lastUpdateID int64, bids, asks []OrderBookEntry) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.orderBooks[symbol] = &OrderBookSnapshot{
		LastUpdateID: lastUpdateID,
		Bids:         bids,
		Asks:         asks,
		FetchedAt:    time.Now(),
	}
}

// GetOrderBook returns the cached order book if it exists and is younger than maxAge.
func (c *MarketCache) GetOrderBook(symbol string, maxAge time.Duration) (*OrderBookSnapshot, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	snap, exists := c.orderBooks[symbol]
	if !exists || time.Since(snap.FetchedAt) > maxAge {
		return nil, false
	}
	return snap, true
}
