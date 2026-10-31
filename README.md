# EthicalAI

EthicalAI turns natural-language requests into governed, traceable AI work.
Every prompt is screened by **Helix**, a governance layer built on
[NVIDIA NeMo Guardrails](https://github.com/NVIDIA-NeMo/Guardrails), before a
local **Gemma 4 12B** model plans and executes it, with human approval at
every risky step.

Everything runs on your machine: one open-weight model served by
[Ollama](https://ollama.com), no cloud API keys, no data leaving the device.

## Features

- **Chat mode**: conversation with Gemma 4 12B. Every message passes a
  guardrails input rail and every reply passes an output rail.
- **Agentic missions**: a request is classified, decomposed into a plan,
  governed, and executed step by step by specialised agents (reasoning,
  coding, files, research, reporting), with live progress.
- **Helix governance**
  - NeMo Guardrails input and output rails running on Gemma
  - Deterministic policy engine: irreversible operations (database or file
    deletion) block the mission; messaging, deployment and credential access
    pause it at that exact step for human approval
  - Risk scoring from what each step touches; model advice can only raise
    risk, never lower it
  - Live console at `/helix` with real decision counts, an activity feed and
    a policy simulator
- **MATRIX security**: prompt pre-scan and plan-level tool/operation scan.
- **Deep research**: a local research loop (query, web search, summarise,
  reflect) that cites its sources.

## Architecture

```
                    ┌──────────────────────────────────────────────┐
  Browser ────────► │ frontend (Next.js 15, port 3000)             │
                    │  chat UI · mission views · Helix console     │
                    └───────┬──────────────────────────┬───────────┘
                            │ server actions           │
                            ▼                          ▼
  ┌──────────────────────────────────────┐   ┌──────────────────────────┐
  │ nexus-backend (FastAPI, port 8001)   │   │ research-agent (8765)    │
  │  MATRIX pre-scan                     │   │  LangGraph research loop │
  │  Helix guardrails (NeMo Guardrails)  │   │  DuckDuckGo search       │
  │  Decision Engine → Planner           │   └────────────┬─────────────┘
  │  HELIX policy + risk → MATRIX scan   │                │
  │  Agent executor (per-step, HITL)     │                │
  └──────────────────┬───────────────────┘                │
                     ▼                                    ▼
             ┌──────────────────────────────────────────────────┐
             │ Ollama (port 11434) · gemma4:12b                 │
             └──────────────────────────────────────────────────┘
```

More detail: [docs/architecture.md](docs/architecture.md) and
[docs/decision-engine.md](docs/decision-engine.md).

## Requirements

- [Ollama](https://ollama.com) with the Gemma 4 12B model (about 8 GB)
- Python 3.11+
- Node.js 20+ (Node 22.5+ recommended for the built-in `node:sqlite`)

## Quick start

```bash
ollama pull gemma4:12b
```

**1. Backend** (governance, missions, guardrails)

```bash
cd nexus-backend
python -m venv .venv && .venv/Scripts/activate   # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python main.py
```

**2. Research agent** (optional, powers deep research)

```bash
cd research-agent
pip install -r requirements.txt
python server.py
```

**3. Frontend**

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. The Helix console is at http://localhost:3000/helix
and the backend API docs are at http://localhost:8001/docs.

The first guarded request loads Gemma into memory and can take a minute; later
requests are much faster.

## Configuration

| Variable | Service | Default | Purpose |
|---|---|---|---|
| `OLLAMA_BASE_URL` | all | `http://127.0.0.1:11434` | Ollama server |
| `MODEL_NAME` | backend, frontend | `gemma4:12b` | Model tag |
| `HELIX_OUTPUT_RAIL` | backend | `true` | Check chat replies (one extra model call) |
| `HELIX_GUARDRAILS_REQUIRED` | backend | `false` | Block missions if the guardrails engine is down |
| `CORS_ORIGINS` | backend, research | `http://localhost:3000,...` | Allowed browser origins |
| `NEXUS_BACKEND_URL` | frontend | `http://localhost:8001` | Backend URL |
| `RESEARCH_AGENT_URL` | frontend | `http://localhost:8765` | Research agent URL |
| `SEARCH_API` | research | `duckduckgo` | `duckduckgo` or `tavily` |

Each service has a `.env.example` listing its variables.

## Helix guardrails API

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/helix/guardrails/status` | Engine state, active rails, decision counts |
| `GET` | `/api/helix/guardrails/events` | Recent decisions, newest first |
| `POST` | `/api/helix/guardrails/check` | Run the input rail on `{"text": "..."}` |
| `POST` | `/api/helix/guardrails/chat` | Guarded chat: input rail → Gemma → output rail |

Rails are defined in
[`nexus-backend/app/services/helix_guardrails/config`](nexus-backend/app/services/helix_guardrails/config);
edit `prompts.yml` to change what is blocked.

## Project structure

```
frontend/         Next.js app (chat, missions, Helix console)
nexus-backend/    FastAPI backend: decision engine, planner, HELIX, MATRIX, agents, guardrails
research-agent/   Local deep-research service
docs/             Architecture and design documents
scripts/          Maintenance utilities (e.g. verify_databases.py)
```

## Known limitations

- Helix decision counts are kept in memory and reset when the backend restarts.
- Running tests and deploying generated code are not supported; missions that
  request them fail explicitly rather than reporting results.
- The Knowledge, Matrix, Blackbox and History dashboards show sample data,
  marked as such in the UI.
- Guarded chat makes three model calls per message (input rail, answer,
  output rail); set `HELIX_OUTPUT_RAIL=false` for faster replies.

## Acknowledgements

- [NVIDIA NeMo Guardrails](https://github.com/NVIDIA-NeMo/Guardrails) (Apache 2.0)
- [Gemma](https://ai.google.dev/gemma) by Google DeepMind
- The research agent is adapted from LangChain's
  [Local Deep Researcher](https://github.com/langchain-ai/local-deep-researcher)
  (MIT); see [research-agent/NOTICE](research-agent/NOTICE).
