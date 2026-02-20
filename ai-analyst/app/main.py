import os
import uvicorn
import logging
from fastapi import FastAPI, Depends, HTTPException, Security, status
from fastapi.security.api_key import APIKeyHeader
from app.schemas import AnalysisRequest, SentimentResponse
from app.services.analyzer import analyzer

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Crypto Thesis AI Analyst", version="0.25")

API_KEY_NAME = "X-API-Key"
EXPECTED_API_KEY = os.environ.get("AI_SERVICE_API_KEY", "thesis_dev_api_key_123!")

api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=True)

async def verify_api_key(api_key: str = Security(api_key_header)):
    if api_key != EXPECTED_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate API Key"
        )
    return api_key

@app.on_event("startup")
def startup_event():
    analyzer.load_model()

# Renamed to /healthz for Kubernetes/Cloud Native compliance
@app.get("/healthz", tags=["Health"])
def health_check():
    return {"status": "online", "service": "ai-analyst"}

@app.post("/api/v1/analyze", response_model=SentimentResponse, tags=["Analysis"])
def analyze_sentiment(
    payload: AnalysisRequest, 
    api_key: str = Depends(verify_api_key)
):
    try:
        return analyzer.predict(payload.text)
    except RuntimeError:
        raise HTTPException(status_code=503, detail="AI Model is not ready yet")
    except Exception as e:
        logging.error(f"Inference error: {e}")
        raise HTTPException(status_code=500, detail="Internal analysis error")

if __name__ == '__main__':
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)