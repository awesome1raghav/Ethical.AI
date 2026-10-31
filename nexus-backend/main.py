"""
NEXUS backend: mission orchestration, governance (HELIX / MATRIX) and the
Helix NeMo Guardrails service, all running on local Gemma 4 12B.

Run:  python main.py        (http://127.0.0.1:8001, docs at /docs)
"""

import logging
import os

from dotenv import load_dotenv

# Load .env before any app module reads configuration.
load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

import uvicorn  # noqa: E402
from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

from app.api.agents_advice import router as agents_router  # noqa: E402
from app.api.analysis import router as analysis_router  # noqa: E402
from app.api.chat import router as chat_router  # noqa: E402
from app.api.decision import router as decision_router  # noqa: E402
from app.api.helix_guardrails import router as helix_guardrails_router  # noqa: E402
from app.api.intent import router as intent_router  # noqa: E402
from app.api.mission import router as mission_router  # noqa: E402
from app.api.research import router as research_router  # noqa: E402
from app.api.websocket import router as websocket_router  # noqa: E402
from app.database.database import engine, migrate_missions_table, reap_orphaned_missions  # noqa: E402
from app.database.models import Base  # noqa: E402

logger = logging.getLogger("nexus")

HOST = os.getenv("NEXUS_HOST", "127.0.0.1")
PORT = int(os.getenv("NEXUS_PORT", "8001"))
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:3002").split(",")
    if origin.strip()
]

Base.metadata.create_all(bind=engine)
migrate_missions_table()

# Missions run as background tasks in this process. Any mission left
# "executing" by a previous process can never finish, so mark it failed.
_orphaned = reap_orphaned_missions()
if _orphaned:
    logger.warning(
        "Marked %d mission(s) failed on startup (orphaned by a previous process): %s",
        len(_orphaned), ", ".join(_orphaned),
    )

app = FastAPI(
    title="EthicalAI NEXUS Backend",
    description="Mission orchestration and governance on local Gemma 4 12B.",
    version="1.1.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

for router in (
    agents_router,
    decision_router,
    mission_router,
    intent_router,
    research_router,
    helix_guardrails_router,
    chat_router,
):
    app.include_router(router, prefix="/api")
app.include_router(analysis_router, prefix="/api/analysis")
app.include_router(websocket_router)


@app.get("/")
def root() -> dict:
    return {"status": "online", "service": "EthicalAI NEXUS Backend"}


if __name__ == "__main__":
    uvicorn.run("main:app", host=HOST, port=PORT, reload=False)
