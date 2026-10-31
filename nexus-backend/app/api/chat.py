"""
/api/chat — Universal Chat Endpoint
Routes any prompt to the selected provider+model and returns a real LLM response.
This is the single source of truth for all AI completions in NEXUS OS.
"""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, List
from app.providers.provider_factory import ProviderFactory

router = APIRouter(prefix="/chat", tags=["Chat"])


class ChatMessage(BaseModel):
    role: str        # "user" | "assistant" | "system"
    content: str


class ChatRequest(BaseModel):
    prompt: str
    model: str = "gemma4:12b"           # ignored: always Gemma 4 12B
    provider: str = "ollama"            # ignored: always Ollama
    mission_id: Optional[str] = None
    session_id: Optional[str] = None
    history: Optional[List[ChatMessage]] = []


class ChatResponse(BaseModel):
    success: bool
    answer: Optional[str] = None
    model: Optional[str] = None
    provider: Optional[str] = None
    tokens: Optional[int] = None
    prompt_tokens: Optional[int] = None
    completion_tokens: Optional[int] = None
    latency_ms: Optional[int] = None
    error: Optional[str] = None


@router.post("/", response_model=ChatResponse)
def chat(request: ChatRequest):
    """
    Every request runs on Gemma 4 12B (local Ollama), whatever model or
    provider the caller names.
    """
    try:
        provider = ProviderFactory.create(request.provider)
    except ValueError as e:
        return ChatResponse(success=False, error=str(e))

    history = [{"role": m.role, "content": m.content} for m in (request.history or [])]

    result = provider.generate(
        model=request.model,
        prompt=request.prompt,
        history=history,
    )

    return ChatResponse(**result)
