"""
Shared LLM client: Gemma 4 12B running locally on Ollama.

This is the only model the backend uses. Every agent, advisor and planner
calls structured_call(), which asks Gemma for JSON matching a pydantic schema
(Ollama structured outputs) and validates it.

The advisory rule is unchanged: the model may raise a concern, never clear
one. Every call returns None on failure, so callers fall back to their
deterministic result.
"""

import logging
import os
import time
from typing import Optional, Type, TypeVar

import requests
from pydantic import BaseModel, ValidationError

logger = logging.getLogger(__name__)

OLLAMA_URL = os.getenv("OLLAMA_BASE_URL", os.getenv("OLLAMA_URL", "http://127.0.0.1:11434")).rstrip("/")
MODEL = os.getenv("MODEL_NAME", "gemma4:12b")
NUM_CTX = int(os.getenv("GEMMA_NUM_CTX", "16384"))

T = TypeVar("T", bound=BaseModel)

# Retry only connection failures; a bad answer is still an answer.
_RETRYABLE_BACKOFF_SECONDS = [1, 3]

# Cache the availability probe briefly so each agent step doesn't re-hit /api/tags.
_AVAILABILITY_TTL = 15.0
_last_check = (0.0, False)


class LLMUnavailable(RuntimeError):
    pass


def llm_available() -> bool:
    """True when Ollama is reachable and the Gemma model is pulled."""
    global _last_check
    now = time.time()
    if now - _last_check[0] < _AVAILABILITY_TTL:
        return _last_check[1]
    ok = False
    try:
        res = requests.get(f"{OLLAMA_URL}/api/tags", timeout=3)
        res.raise_for_status()
        names = {m.get("name") for m in res.json().get("models", [])}
        ok = MODEL in names or f"{MODEL}:latest" in names
        if not ok:
            logger.warning("Ollama is running but %s is not pulled. Run: ollama pull %s", MODEL, MODEL)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Ollama not reachable at %s: %s", OLLAMA_URL, exc)
    _last_check = (now, ok)
    return ok


def chat(messages: list, temperature: float = 0.7, max_tokens: int = 4096,
         fmt=None, timeout: int = 600) -> Optional[str]:
    """Plain chat call. Returns the reply text or None."""
    body = {
        "model": MODEL,
        "messages": messages,
        "stream": False,
        "options": {"temperature": temperature, "num_predict": max_tokens, "num_ctx": NUM_CTX},
    }
    if fmt is not None:
        body["format"] = fmt

    attempt = 0
    while True:
        try:
            res = requests.post(f"{OLLAMA_URL}/api/chat", json=body, timeout=timeout)
            res.raise_for_status()
            return res.json().get("message", {}).get("content")
        except (requests.ConnectionError, requests.Timeout) as exc:
            if attempt >= len(_RETRYABLE_BACKOFF_SECONDS):
                logger.warning("Gemma call failed after %d attempts: %s", attempt + 1, exc)
                return None
            time.sleep(_RETRYABLE_BACKOFF_SECONDS[attempt])
            attempt += 1
        except Exception as exc:  # noqa: BLE001
            logger.warning("Gemma call failed (%s): %s", exc.__class__.__name__, exc)
            return None


_EFFORT_TEMPERATURE = {"low": 0.4, "medium": 0.2, "high": 0.1}


def structured_call(
    system: str,
    prompt: str,
    schema: Type[T],
    effort: str = "medium",
    max_tokens: int = 8000,
) -> Optional[T]:
    """
    One structured request to Gemma, validated against `schema`.
    Returns None on any failure; callers must treat that as "no advice".
    """
    if not llm_available():
        return None

    logger.info("Gemma call: model=%s effort=%s prompt_chars=%d", MODEL, effort, len(prompt))
    content = chat(
        [{"role": "system", "content": system}, {"role": "user", "content": prompt}],
        temperature=_EFFORT_TEMPERATURE.get(effort, 0.2),
        max_tokens=max_tokens,
        fmt=schema.model_json_schema(),
    )
    if not content:
        return None
    try:
        return schema.model_validate_json(content)
    except ValidationError as exc:
        logger.warning("Gemma output did not match %s: %s", schema.__name__, exc)
        return None

