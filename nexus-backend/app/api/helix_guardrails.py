"""/api/helix/guardrails: NeMo Guardrails (Helix layer) on Gemma 4 12B."""

from typing import List

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.services.helix_guardrails import check_input, guarded_chat, guardrails_status, recent_events

router = APIRouter(prefix="/helix/guardrails", tags=["Helix Guardrails"])


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[Message]


class CheckRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=8000)


@router.get("/status")
def status():
    return guardrails_status()


@router.get("/events")
def events(limit: int = Query(20, ge=1, le=100)):
    """Most recent guardrail decisions, newest first."""
    return {"events": recent_events(limit)}


@router.post("/chat")
async def chat(req: ChatRequest):
    if not req.messages:
        raise HTTPException(400, "messages is empty")
    try:
        return await guarded_chat([m.model_dump() for m in req.messages])
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(503, f"Helix guardrails unavailable: {exc}")


@router.post("/check")
async def check(req: CheckRequest):
    try:
        return await check_input(req.text)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(503, f"Helix guardrails unavailable: {exc}")
