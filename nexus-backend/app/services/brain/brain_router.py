from app.services.llm import MODEL

from .models import ModelProvider, SelectedModel


class BrainRouter:
    """Every intent resolves to Gemma 4 12B on local Ollama."""

    @staticmethod
    def select(intent=None, prompt: str = "", capabilities: list = None):
        return SelectedModel(provider=ModelProvider.OLLAMA, model=MODEL)
