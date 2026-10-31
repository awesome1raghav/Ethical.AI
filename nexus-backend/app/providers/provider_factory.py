from .ollama_provider import OllamaProvider


class ProviderFactory:
    """Every provider name resolves to local Gemma 4 12B on Ollama."""

    @staticmethod
    def create(provider=None):
        return OllamaProvider()
