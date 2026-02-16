import logging
from transformers import pipeline
from app.schemas.schemas import SentimentResponse

logger = logging.getLogger(__name__)

class SentimentAnalyzer:
    def __init__(self):
        self._pipeline = None
        self._model_name = "distilbert-base-uncased-finetuned-sst-2-english"

    def load_model(self):
        """Loads the model into memory. Call this on startup."""
        logger.info(f"Loading model: {self._model_name}...")
        try:
            self._pipeline = pipeline("sentiment-analysis", model=self._model_name)
            logger.info("Model loaded successfully.")
        except Exception as e:
            logger.error(f"Critical Error loading model: {e}")
            raise e

    def predict(self, text: str) -> SentimentResponse:
        if not self._pipeline:
            raise RuntimeError("Model is not loaded")

        # Run inference
        results = self._pipeline(text)
        top_result = results[0]

        return SentimentResponse(
            label=top_result['label'],
            score=top_result['score'],
            model_version=self._model_name
        )

# Singleton instance
analyzer = SentimentAnalyzer()