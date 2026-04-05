package telemetry

import (
	"context"
	"log/slog"
	"time"

	"go.opentelemetry.io/contrib/bridges/otelslog"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploggrpc"
	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	otellog "go.opentelemetry.io/otel/log/global"
	"go.opentelemetry.io/otel/propagation"
	sdklog "go.opentelemetry.io/otel/sdk/log"
	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.24.0"
)

// InitProvider connects to the OTEL Collector and sets up traces, metrics, and structured logging.
// Returns the MeterProvider (for creating custom metrics) and a shutdown function.
func InitProvider(serviceName string, collectorAddr string) (*sdkmetric.MeterProvider, func(context.Context) error, error) {
	ctx := context.Background()

	res, err := resource.New(ctx,
		resource.WithAttributes(
			semconv.ServiceNameKey.String(serviceName),
		),
	)
	if err != nil {
		return nil, nil, err
	}

	connCtx, cancel := context.WithTimeout(ctx, time.Second*5)
	defer cancel()

	// --- Traces ---
	traceExporter, err := otlptracegrpc.New(connCtx,
		otlptracegrpc.WithInsecure(),
		otlptracegrpc.WithEndpoint(collectorAddr),
	)
	if err != nil {
		return nil, nil, err
	}

	tracerProvider := sdktrace.NewTracerProvider(
		sdktrace.WithSampler(sdktrace.AlwaysSample()),
		sdktrace.WithResource(res),
		sdktrace.WithBatcher(traceExporter),
	)
	otel.SetTracerProvider(tracerProvider)
	otel.SetTextMapPropagator(propagation.TraceContext{})

	// --- Metrics ---
	metricExporter, err := otlpmetricgrpc.New(connCtx,
		otlpmetricgrpc.WithInsecure(),
		otlpmetricgrpc.WithEndpoint(collectorAddr),
	)
	if err != nil {
		return nil, nil, err
	}

	meterProvider := sdkmetric.NewMeterProvider(
		sdkmetric.WithResource(res),
		sdkmetric.WithReader(sdkmetric.NewPeriodicReader(metricExporter, sdkmetric.WithInterval(10*time.Second))),
	)
	otel.SetMeterProvider(meterProvider)

	// --- Logs (exported to Loki via OTel Collector) ---
	logExporter, err := otlploggrpc.New(connCtx,
		otlploggrpc.WithInsecure(),
		otlploggrpc.WithEndpoint(collectorAddr),
	)
	if err != nil {
		return nil, nil, err
	}

	loggerProvider := sdklog.NewLoggerProvider(
		sdklog.WithResource(res),
		sdklog.WithProcessor(sdklog.NewBatchProcessor(logExporter)),
	)
	otellog.SetLoggerProvider(loggerProvider)

	// Bridge slog → OTel so all slog.Info/Warn/Error calls export to Loki
	slog.SetDefault(slog.New(otelslog.NewHandler(serviceName)))

	// Composite shutdown
	shutdown := func(ctx context.Context) error {
		var firstErr error
		if err := tracerProvider.Shutdown(ctx); err != nil && firstErr == nil {
			firstErr = err
		}
		if err := meterProvider.Shutdown(ctx); err != nil && firstErr == nil {
			firstErr = err
		}
		if err := loggerProvider.Shutdown(ctx); err != nil && firstErr == nil {
			firstErr = err
		}
		return firstErr
	}

	return meterProvider, shutdown, nil
}
