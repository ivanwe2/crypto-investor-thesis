import logging
from transformers import pipeline
from app.schemas.schemas import SentimentResponse

logger = logging.getLogger(__name__)

class SentimentAnalyzer:
    def __init__(self):
        self._pipeline = None
        # ✨ UPGRADE: FinBERT is explicitly trained on financial text!
        self._model_name = "ProsusAI/finbert"

    def load_model(self):
        """Loads the financial NLP model into memory. Call this on startup."""
        logger.info(f"Loading financial NLP model: {self._model_name}...")
        try:
            # We use device=-1 to force CPU execution (safe for Docker/Thesis environments)
            self._pipeline = pipeline("sentiment-analysis", model=self._model_name, device=-1)
            logger.info("✅ FinBERT model loaded successfully.")
        except Exception as e:
            logger.error(f"Critical Error loading model: {e}")
            raise e

    def predict(self, text: str) -> SentimentResponse:
        if not self._pipeline:
            raise RuntimeError("Model is not loaded")

        # Run inference on the financial text
        results = self._pipeline(text)
        top_result = results[0]

        raw_label = top_result['label'].lower()
        score = top_result['score']

        # Map FinBERT's output to Crypto/Trading terminology
        if raw_label == "positive":
            mapped_label = "BULLISH"
        elif raw_label == "negative":
            mapped_label = "BEARISH"
        else:
            mapped_label = "NEUTRAL"

        return SentimentResponse(
            label=mapped_label,
            score=score,
            model_version=self._model_name
        )

# Singleton instance
analyzer = SentimentAnalyzer()