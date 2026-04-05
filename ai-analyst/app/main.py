import os
import uvicorn
import logging
import threading
from fastapi import FastAPI, Depends, HTTPException, Security, status
from fastapi.security.api_key import APIKeyHeader
from opentelemetry import trace
from app.schemas.schemas import AnalysisRequest, SentimentResponse
from app.services.analyzer import analyzer
from app.messaging.rabbit_worker import AIRabbitWorker
from app.telemetry.telemetry import init_telemetry

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Crypto Thesis AI Analyst", version="0.5")

API_KEY_NAME = "X-API-Key"
EXPECTED_API_KEY = os.environ.get("AI_SERVICE_API_KEY", "thesis_dev_api_key_123!")
api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=True)

tracer = trace.get_tracer(__name__)

async def verify_api_key(api_key: str = Security(api_key_header)):
    if api_key != EXPECTED_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate API Key"
        )
    return api_key

@app.on_event("startup")
def startup_event():
    init_telemetry()
    analyzer.load_model()
    amqp_url = os.environ.get("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")
    worker = AIRabbitWorker(amqp_url)
    threading.Thread(target=worker.start, daemon=True).start()
    logging.info("RabbitMQ Background Worker started alongside FastAPI.")

@app.get("/healthz", tags=["Health"])
def health_check():
    return {"status": "online", "service": "ai-analyst", "model": "ProsusAI/finbert"}

@app.post("/api/v1/analyze", response_model=SentimentResponse, tags=["Analysis"])
def analyze_sentiment(
    payload: AnalysisRequest,
    api_key: str = Depends(verify_api_key)
):
    with tracer.start_as_current_span("POST /api/v1/analyze") as span:
        span.set_attribute("input.text_length", len(payload.text))
        try:
            result = analyzer.predict(payload.text)
            span.set_attribute("ai.signal", result.label)
            span.set_attribute("ai.confidence", result.score)
            return result
        except RuntimeError:
            span.set_status(trace.StatusCode.ERROR, "Model not ready")
            raise HTTPException(status_code=503, detail="AI Model is not ready yet")
        except Exception as e:
            span.record_exception(e)
            logging.error(f"Inference error: {e}")
            raise HTTPException(status_code=500, detail="Internal analysis error")

if __name__ == '__main__':
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
