package analytics

import (
	"math"
	"sync"
)

// Welford calculates running variance and standard deviation online.
// O(1) memory complexity, perfect for streaming high-frequency data.
type Welford struct {
	mu    sync.Mutex
	count int64
	mean  float64
	m2    float64
}

func NewWelford() *Welford {
	return &Welford{}
}

// Update adds a new price to the calculation and returns the current Standard Deviation (Volatility)
func (w *Welford) Update(price float64) float64 {
	w.mu.Lock()
	defer w.mu.Unlock()

	w.count++
	delta := price - w.mean
	w.mean += delta / float64(w.count)
	delta2 := price - w.mean
	w.m2 += delta * delta2

	if w.count < 2 {
		return 0.0
	}
	variance := w.m2 / float64(w.count-1)
	return math.Sqrt(variance)
}

// VolatilityTracker manages Welford calculators for multiple symbols
type VolatilityTracker struct {
	mu       sync.RWMutex
	trackers map[string]*Welford
}

func NewVolatilityTracker() *VolatilityTracker {
	return &VolatilityTracker{
		trackers: make(map[string]*Welford),
	}
}

// ProcessTick updates the volatility for a symbol and returns the new volatility score
func (vt *VolatilityTracker) ProcessTick(symbol string, price float64) float64 {
	vt.mu.Lock()
	tracker, exists := vt.trackers[symbol]
	if !exists {
		tracker = NewWelford()
		vt.trackers[symbol] = tracker
	}
	vt.mu.Unlock()

	return tracker.Update(price)
}
