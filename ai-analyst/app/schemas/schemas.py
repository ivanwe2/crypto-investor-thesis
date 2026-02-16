from pydantic import BaseModel, Field

class AnalysisRequest(BaseModel):
    text: str = Field(..., min_length=1, description="The text content to analyze")
    # Future extensibility: We can add fields like 'mode' (fast vs accurate)
    # mode: str = "standard" 

class SentimentResponse(BaseModel):
    label: str
    score: float
    model_version: str = "distilbert-base" # Good for tracking which model gave the answer