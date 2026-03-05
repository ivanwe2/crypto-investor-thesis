package telemetry

import (
	"context"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.24.0"
)

// InitProvider connects to the OTEL Collector and sets up the global tracer.
func InitProvider(serviceName string, collectorAddr string) (func(context.Context) error, error) {
	ctx := context.Background()

	res, err := resource.New(ctx,
		resource.WithAttributes(
			semconv.ServiceNameKey.String(serviceName),
		),
	)
	if err != nil {
		return nil, err
	}

	// Connect to the OTEL Collector via gRPC (e.g., "otel-collector:4317")
	ctx, cancel := context.WithTimeout(ctx, time.Second*5)
	defer cancel()

	traceExporter, err := otlptracegrpc.New(ctx,
		otlptracegrpc.WithInsecure(),
		otlptracegrpc.WithEndpoint(collectorAddr),
	)
	if err != nil {
		return nil, err
	}

	// Register the trace exporter
	bsp := sdktrace.NewBatchSpanProcessor(traceExporter)
	tracerProvider := sdktrace.NewTracerProvider(
		sdktrace.WithSampler(sdktrace.AlwaysSample()),
		sdktrace.WithResource(res),
		sdktrace.WithSpanProcessor(bsp),
	)
	otel.SetTracerProvider(tracerProvider)

	// ✨ CRITICAL STEP: Set the global propagator to W3C Trace Context.
	// This ensures Go formats the trace IDs exactly how .NET expects to read them!
	otel.SetTextMapPropagator(propagation.TraceContext{})

	// Return a shutdown function so main.go can cleanly flush logs on exit
	return tracerProvider.Shutdown, nil
}
