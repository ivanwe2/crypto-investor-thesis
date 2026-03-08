import os
import logging
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource, SERVICE_NAME

logger = logging.getLogger(__name__)

def init_telemetry():
    """Configures OpenTelemetry to send traces to the Grafana LGTM stack."""
    
    # Define the name that will show up in Grafana Tempo
    resource = Resource.create({
        SERVICE_NAME: "ai-analyst"
    })

    # Create the Tracer Provider
    provider = TracerProvider(resource=resource)

    # Configure the OTLP Exporter (pointing to the Docker otel-collector)
    otel_endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://otel-collector:4317")
    
    try:
        exporter = OTLPSpanExporter(endpoint=otel_endpoint, insecure=True)
        processor = BatchSpanProcessor(exporter)
        provider.add_span_processor(processor)
        
        # Register the provider globally
        trace.set_tracer_provider(provider)
        logger.info(f"✅ OpenTelemetry configured. Exporting traces to {otel_endpoint}")
    except Exception as e:
        logger.error(f"❌ Failed to initialize OpenTelemetry: {e}")