import os
import logging
from opentelemetry import trace, metrics
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource, SERVICE_NAME
from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry.exporter.otlp.proto.grpc._log_exporter import OTLPLogExporter
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter

logger = logging.getLogger(__name__)

def init_telemetry():
    """Configures OpenTelemetry to send traces, logs, and metrics to the Grafana LGTM stack."""

    resource = Resource.create({
        SERVICE_NAME: "ai-analyst"
    })

    otel_endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://otel-collector:4317")

    try:
        # --- Traces ---
        trace_exporter = OTLPSpanExporter(endpoint=otel_endpoint, insecure=True)
        trace_provider = TracerProvider(resource=resource)
        trace_provider.add_span_processor(BatchSpanProcessor(trace_exporter))
        trace.set_tracer_provider(trace_provider)

        # --- Logs (exported to Loki via OTel Collector) ---
        log_exporter = OTLPLogExporter(endpoint=otel_endpoint, insecure=True)
        logger_provider = LoggerProvider(resource=resource)
        logger_provider.add_log_record_processor(BatchLogRecordProcessor(log_exporter))
        handler = LoggingHandler(level=logging.INFO, logger_provider=logger_provider)
        logging.getLogger().addHandler(handler)

        # --- Metrics ---
        metric_exporter = OTLPMetricExporter(endpoint=otel_endpoint, insecure=True)
        metric_reader = PeriodicExportingMetricReader(metric_exporter, export_interval_millis=10000)
        meter_provider = MeterProvider(resource=resource, metric_readers=[metric_reader])
        metrics.set_meter_provider(meter_provider)

        logger.info(f"OpenTelemetry configured: traces, logs, and metrics exporting to {otel_endpoint}")
    except Exception as e:
        logger.error(f"Failed to initialize OpenTelemetry: {e}")
