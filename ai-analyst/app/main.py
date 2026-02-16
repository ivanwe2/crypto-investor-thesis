import uvicorn
import logging
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from transformers import pipeline

# Configure Logging (No Emojis)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Global variable to hold the model in memory
sentiment_pipeline = None

class SentimentRequest(BaseModel):
    text: str

class SentimentResponse(BaseModel):
    label: str
    score: float

@app.on_event("startup")
def load_model():
    global sentiment_pipeline
    logger.info("Loading AI Model... This may take time on first run.")
    try:
        # We use a default distilled model for speed. 
        # For a thesis, you could swap this for "ProsusAI/finbert" later.
        sentiment_pipeline = pipeline("sentiment-analysis")
        logger.info("AI Model loaded successfully.")
    except Exception as e:
        logger.error(f"Failed to load AI model: {e}")

@app.get("/")
def health_check():
    return {"status": "AI Analyst Online"}

@app.post("/analyze", response_model=SentimentResponse)
def analyze_sentiment(request: SentimentRequest):
    if not sentiment_pipeline:
        raise HTTPException(status_code=503, detail="Model is loading")
    
    try:
        # Run inference
        results = sentiment_pipeline(request.text)
        # Result looks like: [{'label': 'POSITIVE', 'score': 0.99}]
        top_result = results[0]
        
        return SentimentResponse(
            label=top_result['label'],
            score=top_result['score']
        )
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        raise HTTPException(status_code=500, detail="Prediction failed")

if __name__ == '__main__':
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)