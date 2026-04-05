package telemetry

import (
	"go.opentelemetry.io/otel/metric"
	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
)

// IngestorMetrics holds custom business metrics for the ingestor service.
type IngestorMetrics struct {
	TradesIngested         metric.Int64Counter
	WebSocketReconnections metric.Int64Counter
	ActiveSubscriptions    metric.Int64UpDownCounter
}

func NewMetrics(mp *sdkmetric.MeterProvider) (*IngestorMetrics, error) {
	meter := mp.Meter("ingestor")

	trades, err := meter.Int64Counter("ingestor.trades_ingested",
		metric.WithDescription("Total trades ingested from Binance"))
	if err != nil {
		return nil, err
	}

	reconnections, err := meter.Int64Counter("ingestor.websocket_reconnections",
		metric.WithDescription("WebSocket reconnection count"))
	if err != nil {
		return nil, err
	}

	subscriptions, err := meter.Int64UpDownCounter("ingestor.active_subscriptions",
		metric.WithDescription("Currently active symbol subscriptions"))
	if err != nil {
		return nil, err
	}

	return &IngestorMetrics{
		TradesIngested:         trades,
		WebSocketReconnections: reconnections,
		ActiveSubscriptions:    subscriptions,
	}, nil
}
