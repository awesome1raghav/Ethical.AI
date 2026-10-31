"""
Research agent HTTP service.

Runs the local deep-research graph (Gemma 4 12B on Ollama + web search) and
exposes it to the EthicalAI frontend.

    POST /research   {"topic": "..."}  ->  {"topic", "summary", "status"}
    GET  /health
"""

import asyncio
import logging
import os

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from assistant.configuration import Configuration
from assistant.graph import graph

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("research-agent")
for noisy in ("primp", "httpx", "httpcore"):
    logging.getLogger(noisy).setLevel(logging.WARNING)

DEFAULTS = Configuration()
ALLOWED_ORIGINS = os.environ.get("CORS_ORIGINS", "http://localhost:3000,http://localhost:3002").split(",")

app = FastAPI(
    title="EthicalAI Research Agent",
    description="Local deep web research powered by Gemma 4 12B on Ollama.",
    version="2.1.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in ALLOWED_ORIGINS],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


class ResearchRequest(BaseModel):
    topic: str = Field(..., min_length=3, max_length=2000)
    max_loops: int = Field(DEFAULTS.max_web_research_loops, ge=1, le=5)
    ollama_model: str = DEFAULTS.local_llm
    ollama_base_url: str = DEFAULTS.ollama_base_url


class ResearchResponse(BaseModel):
    topic: str
    summary: str
    status: str = "completed"


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "agent": "research_agent",
        "provider": "ollama",
        "model": DEFAULTS.local_llm,
        "search_api": DEFAULTS.search_api.value,
    }


@app.post("/research", response_model=ResearchResponse)
async def run_research(req: ResearchRequest) -> ResearchResponse:
    """Run the research loop for a topic and return a Markdown summary."""
    config = {
        "configurable": {
            "local_llm": req.ollama_model,
            "ollama_base_url": req.ollama_base_url,
            "max_web_research_loops": req.max_loops,
        }
    }
    logger.info("Research started: %r (loops=%d, model=%s)", req.topic, req.max_loops, req.ollama_model)
    try:
        result = await asyncio.to_thread(graph.invoke, {"research_topic": req.topic}, config)
    except Exception as exc:
        logger.exception("Research failed for %r", req.topic)
        raise HTTPException(status_code=500, detail=f"Research agent error: {exc}") from exc

    return ResearchResponse(topic=req.topic, summary=result.get("running_summary") or "No summary generated.")


if __name__ == "__main__":
    port = int(os.environ.get("RESEARCH_AGENT_PORT", "8765"))
    logger.info("Research agent listening on http://localhost:%d (model: %s)", port, DEFAULTS.local_llm)
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")
