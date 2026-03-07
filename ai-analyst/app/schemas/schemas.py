from pydantic import BaseModel, Field

class AnalysisRequest(BaseModel):
    text: str = Field(..., min_length=1, description="The financial text or news headline to analyze")

class SentimentResponse(BaseModel):
    label: str = Field(..., description="BULLISH, BEARISH, or NEUTRAL")
    score: float = Field(..., description="Confidence score from 0.0 to 1.0")
    model_version: str = Field(default="ProsusAI/finbert")