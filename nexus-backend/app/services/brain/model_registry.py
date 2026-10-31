from app.services.llm import MODEL

from .models import ModelProvider

# One local model for every intent: Gemma 4 12B on Ollama.
MODEL_REGISTRY = {
    intent: (ModelProvider.OLLAMA, MODEL)
    for intent in ("CHAT", "RESEARCH", "CODING", "FILE", "AUTOMATION")
}
