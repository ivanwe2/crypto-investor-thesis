import uvicorn
import logging
from fastapi import FastAPI, HTTPException
from app.schemas.schemas import AnalysisRequest, SentimentResponse
from app.services.analyzer import analyzer

# Configure Logging
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Crypto Thesis AI Analyst", version="1.0.0")

@app.on_event("startup")
def startup_event():
    # Load model on startup
    analyzer.load_model()

@app.get("/health")
def health_check():
    return {"status": "online", "service": "ai-analyst"}

@app.post("/api/v1/analyze", response_model=SentimentResponse)
def analyze_sentiment(payload: AnalysisRequest):
    try:
        return analyzer.predict(payload.text)
    except RuntimeError:
        raise HTTPException(status_code=503, detail="AI Model is not ready yet")
    except Exception as e:
        logging.error(f"Inference error: {e}")
        raise HTTPException(status_code=500, detail="Internal analysis error")

if __name__ == '__main__':
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)