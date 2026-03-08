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

type MarketCache struct {
	mu   sync.RWMutex
	data map[string]*MarketSnapshot
}

func NewMarketCache() *MarketCache {
	return &MarketCache{
		data: make(map[string]*MarketSnapshot),
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
