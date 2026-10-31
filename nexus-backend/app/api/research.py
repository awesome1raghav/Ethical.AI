"""/api/research: single-pass web research (search + Gemma report)."""

import asyncio
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.research_service import ResearchUnavailable, run_research

router = APIRouter(prefix="/research", tags=["research"])


class ResearchRequest(BaseModel):
    query: str = Field(..., min_length=3, max_length=2000)


class ResearchResponse(BaseModel):
    status: str
    report: Optional[str] = None
    error: Optional[str] = None


@router.post("/research", response_model=ResearchResponse)
async def perform_research(request: ResearchRequest) -> ResearchResponse:
    try:
        report = await asyncio.to_thread(run_research, request.query)
    except ResearchUnavailable as exc:
        return ResearchResponse(status="error", error=str(exc))
    return ResearchResponse(status="success", report=report)


@router.get("/health")
async def health_check() -> dict:
    return {"status": "healthy", "agent": "web-research"}
