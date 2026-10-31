"""
Helix guardrails: NVIDIA NeMo Guardrails wrapped around Gemma 4 12B.

guarded_chat()  input rail -> Gemma -> output rail, in one call
check_input()   input rail only (cheap pre-check for missions / policy checks)

Every decision is appended to an in-memory event log (most recent first) that
backs the Helix console. The log resets when the process restarts.

The rails config lives in ./config. Model and Ollama URL come from the same
env vars as the rest of the backend (MODEL_NAME, OLLAMA_BASE_URL).
Set HELIX_OUTPUT_RAIL=false to skip the output check and save one Gemma call.
"""

import asyncio
import concurrent.futures
import itertools
import logging
import os
import threading
import time
from collections import deque
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

CONFIG_DIR = Path(__file__).parent / "config"
OUTPUT_RAIL_ENABLED = os.getenv("HELIX_OUTPUT_RAIL", "true").lower() in ("1", "true", "yes")
EVENT_LOG_SIZE = 100
EXCERPT_CHARS = 140

_rails = None
_load_error: Optional[str] = None
_lock = asyncio.Lock()

# NeMo's LLMRails is bound to the event loop it first runs on, while callers
# come from both the FastAPI loop and synchronous mission worker threads. All
# guardrail work therefore runs on one dedicated background loop.
_loop: Optional[asyncio.AbstractEventLoop] = None
_loop_guard = threading.Lock()


def _submit(coro) -> concurrent.futures.Future:
    global _loop
    with _loop_guard:
        if _loop is None:
            _loop = asyncio.new_event_loop()
            threading.Thread(target=_loop.run_forever, name="helix-guardrails", daemon=True).start()
    return asyncio.run_coroutine_threadsafe(coro, _loop)

_events: deque = deque(maxlen=EVENT_LOG_SIZE)
_event_ids = itertools.count(1)
_totals = {"checks": 0, "blocked": 0, "latency_ms": 0}


def _build_rails():
    from nemoguardrails import LLMRails, RailsConfig

    from app.services.llm import MODEL
    from app.services.llm.gemma_client import OLLAMA_URL

    config = RailsConfig.from_path(str(CONFIG_DIR))
    for m in config.models:
        if m.type == "main":
            m.model = MODEL
            # NeMo talks to Ollama through its OpenAI-compatible /v1 API.
            m.parameters["base_url"] = f"{OLLAMA_URL}/v1"
    if not OUTPUT_RAIL_ENABLED:
        config.rails.output.flows = []
    return LLMRails(config)


async def _get_rails():
    global _rails, _load_error
    if _rails is not None:
        return _rails
    async with _lock:
        if _rails is None:
            try:
                _rails = await asyncio.to_thread(_build_rails)
                _load_error = None
                logger.info("Helix guardrails loaded from %s", CONFIG_DIR)
            except Exception as exc:  # noqa: BLE001
                _load_error = f"{exc.__class__.__name__}: {exc}"
                logger.exception("Failed to load Helix guardrails")
                raise
    return _rails


def _blocking_rail(log) -> Optional[str]:
    """Name of the rail that stopped generation, if any."""
    for rail in (getattr(log, "activated_rails", None) or []):
        if rail.stop:
            return f"{rail.type}:{rail.name}"
    return None


def _last_content(response) -> str:
    if isinstance(response, list) and response:
        return response[-1].get("content", "")
    return str(response or "")


def _excerpt(text: str) -> str:
    text = " ".join(text.split())
    return text if len(text) <= EXCERPT_CHARS else text[: EXCERPT_CHARS - 1] + "…"


def _record(kind: str, text: str, rail: Optional[str], started: float) -> None:
    latency_ms = int((time.perf_counter() - started) * 1000)
    blocked = rail is not None
    _totals["checks"] += 1
    _totals["blocked"] += int(blocked)
    _totals["latency_ms"] += latency_ms
    _events.appendleft({
        "id": next(_event_ids),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "kind": kind,
        "excerpt": _excerpt(text),
        "blocked": blocked,
        "rail": rail,
        "latency_ms": latency_ms,
    })


async def guarded_chat(messages: list) -> dict:
    """Input rail -> Gemma -> output rail. Safe to await from any event loop."""
    return await asyncio.wrap_future(_submit(_guarded_chat(messages)))


async def check_input(text: str) -> dict:
    """Input rail only. Safe to await from any event loop."""
    return await asyncio.wrap_future(_submit(_check_input(text)))


def check_input_sync(text: str, timeout: float = 120) -> dict:
    """Blocking input-rail check for synchronous callers (mission pipeline)."""
    return _submit(_check_input(text, kind="mission")).result(timeout=timeout)


async def _guarded_chat(messages: list) -> dict:
    started = time.perf_counter()
    rails = await _get_rails()
    res = await rails.generate_async(
        messages=[{"role": m["role"], "content": m["content"]} for m in messages],
        options={"log": {"activated_rails": True}},
    )
    rail = _blocking_rail(res.log)
    user_text = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
    _record("chat", user_text, rail, started)
    return {"content": _last_content(res.response), "blocked": rail is not None, "rail": rail}


async def _check_input(text: str, kind: str = "check") -> dict:
    started = time.perf_counter()
    rails = await _get_rails()
    res = await rails.generate_async(
        messages=[{"role": "user", "content": text}],
        options={"rails": ["input"], "log": {"activated_rails": True}},
    )
    rail = _blocking_rail(res.log)
    _record(kind, text, rail, started)
    return {
        "allowed": rail is None,
        "rail": rail,
        "message": _last_content(res.response) if rail else None,
        "latency_ms": _events[0]["latency_ms"],
    }


def recent_events(limit: int = 20) -> list[dict]:
    return list(itertools.islice(_events, max(0, limit)))


def guardrails_status() -> dict:
    from app.services.llm import MODEL

    checks = _totals["checks"]
    return {
        "engine": "nvidia-nemo-guardrails",
        "model": MODEL,
        "loaded": _rails is not None,
        "error": _load_error,
        "input_rails": ["self check input"],
        "output_rails": ["self check output"] if OUTPUT_RAIL_ENABLED else [],
        "stats": {
            "checks": checks,
            "blocked": _totals["blocked"],
            "allowed": checks - _totals["blocked"],
            "avg_latency_ms": _totals["latency_ms"] // checks if checks else None,
        },
    }
