package exchange

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
)

const binanceRestBaseURL = "https://api.binance.com/api/v3"

var httpClient = &http.Client{
	Timeout: 10 * time.Second,
}

// KlineData represents the mapped OHLCV data
type KlineData struct {
	StartTimeUTC int64
	Open         float64
	High         float64
	Low          float64
	Close        float64
	Volume       float64
}

// OrderBookData represents the mapped Level 2 Depth
type OrderBookData struct {
	LastUpdateID int64
	Bids         []OrderBookEntry
	Asks         []OrderBookEntry
}

type OrderBookEntry struct {
	Price float64
	Size  float64
}

// FetchHistoricalKlines calls Binance GET /api/v3/klines
func FetchHistoricalKlines(ctx context.Context, symbol string, interval string, limit int32) ([]KlineData, error) {
	tr := otel.Tracer("exchange")
	ctx, span := tr.Start(ctx, "Binance REST: Get Klines")
	span.SetAttributes(attribute.String("symbol", symbol), attribute.String("interval", interval))
	defer span.End()

	url := fmt.Sprintf("%s/klines?symbol=%s&interval=%s&limit=%d", binanceRestBaseURL, symbol, interval, limit)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("binance api error: status %d", resp.StatusCode)
	}

	// Binance returns an array of mixed-type arrays:
	// [ [1499040000000, "0.01633102", "0.80000000", ...], ... ]
	var rawKlines [][]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&rawKlines); err != nil {
		return nil, err
	}

	var klines []KlineData
	for _, k := range rawKlines {
		if len(k) < 6 {
			continue
		}

		// Parse timestamp (Binance returns milliseconds, we convert to seconds for the UI)
		openTimeMs := int64(k[0].(float64))

		// Parse strings to float64
		open, _ := strconv.ParseFloat(k[1].(string), 64)
		high, _ := strconv.ParseFloat(k[2].(string), 64)
		low, _ := strconv.ParseFloat(k[3].(string), 64)
		close, _ := strconv.ParseFloat(k[4].(string), 64)
		volume, _ := strconv.ParseFloat(k[5].(string), 64)

		klines = append(klines, KlineData{
			StartTimeUTC: openTimeMs / 1000,
			Open:         open,
			High:         high,
			Low:          low,
			Close:        close,
			Volume:       volume,
		})
	}

	return klines, nil
}

// FetchOrderBookDepth calls Binance GET /api/v3/depth
func FetchOrderBookDepth(ctx context.Context, symbol string, limit int32) (*OrderBookData, error) {
	tr := otel.Tracer("exchange")
	ctx, span := tr.Start(ctx, "Binance REST: Get Depth")
	span.SetAttributes(attribute.String("symbol", symbol))
	defer span.End()

	url := fmt.Sprintf("%s/depth?symbol=%s&limit=%d", binanceRestBaseURL, symbol, limit)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("binance api error: status %d", resp.StatusCode)
	}

	// Binance Depth Format: {"lastUpdateId": 123, "bids": [["price","qty"]], "asks": [["price","qty"]]}
	var rawDepth struct {
		LastUpdateID int64      `json:"lastUpdateId"`
		Bids         [][]string `json:"bids"`
		Asks         [][]string `json:"asks"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&rawDepth); err != nil {
		return nil, err
	}

	result := &OrderBookData{
		LastUpdateID: rawDepth.LastUpdateID,
		Bids:         make([]OrderBookEntry, 0, len(rawDepth.Bids)),
		Asks:         make([]OrderBookEntry, 0, len(rawDepth.Asks)),
	}

	for _, b := range rawDepth.Bids {
		price, _ := strconv.ParseFloat(b[0], 64)
		qty, _ := strconv.ParseFloat(b[1], 64)
		result.Bids = append(result.Bids, OrderBookEntry{Price: price, Size: qty})
	}

	for _, a := range rawDepth.Asks {
		price, _ := strconv.ParseFloat(a[0], 64)
		qty, _ := strconv.ParseFloat(a[1], 64)
		result.Asks = append(result.Asks, OrderBookEntry{Price: price, Size: qty})
	}

	return result, nil
}
