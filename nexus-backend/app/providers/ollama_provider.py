import time

from app.services.llm import MODEL, chat

from .base_provider import BaseProvider


class OllamaProvider(BaseProvider):
    """Gemma 4 12B on local Ollama. The only provider in this backend."""

    def generate(self, model: str = MODEL, prompt: str = "", history: list = None) -> dict:
        start = time.time()
        messages = [
            {"role": "user" if h["role"] == "user" else "assistant", "content": h["content"]}
            for h in (history or [])
        ]
        messages.append({"role": "user", "content": prompt})

        content = chat(messages)
        if content is None:
            return {
                "success": False,
                "error": f"Gemma ({MODEL}) is not reachable. Is Ollama running?",
                "model": MODEL,
                "provider": "ollama",
            }
        prompt_tokens = max(1, len(prompt) // 4)
        completion_tokens = max(1, len(content) // 4)
        return {
            "success": True,
            "answer": content,
            "model": MODEL,
            "provider": "ollama",
            "tokens": prompt_tokens + completion_tokens,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "latency_ms": int((time.time() - start) * 1000),
        }
