# Decision Engine — Complete Architecture

Front of the NEXUS pipeline. Implements Chapter 4, plus the confidence and complexity
axes the document names but never specifies.

> **Revised** after review of the intake screen. The UI contract already exists and the
> richest implementation turns out to live in the frontend. See §0 and §2.

---

## 0. There are four decision engines

| # | Location | Method | Confidence | Status |
|---|---|---|---|---|
| 1 | `nexus-backend/app/services/intent/` | 20 keywords, first-match-wins | **hardcoded `1.0`** | canonical backend, weakest |
| 2 | `Ethical-AI-main/backend/nexus/intent_engine/` | weighted 4-signal voting | margin-based, 55–95 | **orphaned** — correct design |
| 3 | `frontend/src/app/page.tsx` → `localFastAnalysis()` | word-count regex | **word count** | runs on every keystroke |
| 4 | `frontend/src/ai/flows/natural-language-mission-intake.ts` | Genkit LLM flow | LLM-assigned | **the one actually running** |

\#4 is by far the richest — it returns intent, secondary intents, domain, objective, actions,
entities, stakeholders, authority level, workflow steps + complexity, human-impact flags,
six governance signals, confidence, clarity score, risk level, evidence, reasoning,
per-step agent assignment with legality, and suggested agents. Backed by a deterministic
`helix/intelligence-kernel.ts` (`evaluateRiskLevel`, `calculateClarityScore`).

**The most advanced decision engine in this project is TypeScript running in the Next tier,
and the FastAPI backend has never seen it.**

Note also that #3 → #4 is *already* the two-tier escalation pattern: `localFastAnalysis`
paints instantly, a 1200 ms debounce fires the LLM flow, and `displayData = aiResult ?? localResult`
swaps it in. The pattern is right. The tiers are in the wrong process and tier-1 is broken.

---

## 1. The UI contract already exists

The intake screen's Intelligence Panel renders exactly the three signals, and two more:

```
DETECTED INTENT      Research & Analysis
CONFIDENCE SCORE     85%          ▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▁▁▁
COMPLEXITY           LOW          ▇▇▇▇▁▁▁▁▁▁▁▁
DURATION  ~2 min     COST  $0.00
```

This is the consumer contract. `DecisionRecord` must serve it directly — intent label,
0–100 confidence for the bar, banded complexity for the segments, duration estimate, cost
estimate. Any backend design that doesn't emit these five fields breaks this screen.

The four subsystem tiles below it — EthicalAI, Helix, **Citadel**, Matrix — introduce a
fourth subsystem the document never mentions. Chapters 1–25 cover NEXUS/HELIX/MATRIX only.
Citadel needs a chapter or it needs to come off the screen.

---

## 2. Three defects, in priority order

### 2.1 The Intelligence Panel is decorative — its values are discarded on launch

`app/page.tsx:366`:

```ts
await saveMission(missionId, input, displayData?.primary_intent || "General", "Low", 70, steps, []);
await createNexusMission(input.trim());
```

- Complexity is hardcoded `"Low"` — `displayData.workflow.complexity` is thrown away
- Confidence is hardcoded `70` — `displayData.confidence` is thrown away
- `createNexusMission(input.trim())` sends **only the raw prompt**

So the full LLM analysis is rendered to the user, then dropped. The backend re-derives
intent from scratch with its 20-keyword matcher, and HELIX/MATRIX never see the risk level,
governance signals, or human-impact flags that were already computed. The screen shows
governance intelligence the system does not act on.

**This is the highest-priority fix in the project.** It is also the hardest claim to defend
in a review: the transparency chapter is demonstrated by a panel whose numbers reach nothing.

### 2.2 Tier-1 confidence is verbosity, not certainty

```ts
const confidenceScore = Math.min(98, Math.round(Math.min(1, wordCount / 20) * 85 + (wordCount > 8 ? 13 : 0)));
```

Confidence is computed from **word count**. A longer prompt scores higher regardless of how
ambiguous it is. For the screenshot's prompt (4 words) this yields **17%** — the user sees
17% flash, then jump to 85% when the LLM flow lands 1.2 s later.

Confidence must come from the *margin* between the top two candidate intents. Two intents at
0.80 and 0.79 is a coin flip and must never read as confident.

### 2.3 Complexity contradicts the specification

The panel reports **LOW** for "Research About Quantum Computing". Ch. 4.5 lists
"Research AI Governance" as a **Complex** example requiring mission flow. Backend #1 has the
same class of bug in the opposite direction. Neither implementation scores complexity — #3
counts words, #1 doesn't model it at all.

### 2.4 Mode is chosen by a human, not the engine

`Chat Mode / Agentic Mode` is a manual toggle, and the analysis is gated on it:

```ts
if (interactionMode !== "agentic") return;
```

In Chat Mode no intent analysis runs at all. The routing decision Chapter 4 assigns to the
Decision Engine is currently made by the user clicking a segmented control.

**Resolution:** keep the toggle as an *override*, not the source of truth. Default it to
`AUTO`; the engine picks; the user can force. The override is recorded in the DecisionRecord
so the audit trail shows who decided.

---

## 3. Core principle: three orthogonal questions

| Signal | Question | Derived from | Controls |
|---|---|---|---|
| **Intent** | *What kind* of work? | prompt semantics | capabilities, agent selection, model |
| **Complexity** | *How much* work? | scope, resources, output | CHAT vs MISSION — plan or not |
| **Confidence** | *How sure* are we? | score margin | proceed / clarify / escalate to HITL |

Intent and complexity are independent axes. Confidence **gates both**.

---

## 4. Target pipeline

One engine, in FastAPI, called by the Next tier for the live panel.

```
                        User Prompt
                             │
              ┌──────────────▼──────────────┐
              │ Stage 0  Normalize + Prescan│  ← MATRIX injection scan HERE,
              └──────────────┬──────────────┘    before we trust the text
                             │
              ┌──────────────▼──────────────┐
              │ Stage 1  Signal Extraction  │
              │  domain │ entity │ objective│ action
              └──────────────┬──────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                                         ▼
┌───────────────┐                        ┌────────────────┐
│ Stage 2       │                        │ Stage 4        │
│ Intent Voting │                        │ Complexity     │
│ weighted sum  │                        │ 5-factor score │
└───────┬───────┘                        └────────┬───────┘
        ▼                                         │
┌───────────────┐                                 │
│ Stage 3       │  conf < 75 ──► Stage 3b         │
│ Confidence    │                LLM Classifier   │
│ margin-based  │                (ported Genkit)  │
└───────┬───────┘                                 │
        └────────────────────┬────────────────────┘
                             ▼
                  ┌──────────────────────┐
                  │ Stage 5  Router      │
                  │ confidence×complexity│
                  └──────────┬───────────┘
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
     CLARIFY               CHAT               MISSION
   (ask user)         (Gemma 4 12B)      (Planner→HELIX→MATRIX)
                                                  │
                                                  ▼
                                        Stage 7 Re-evaluation
                                     (actual DAG vs estimate)
                                                  │
                             └────────────────────┘
                                   feedback edge
                             ▼
              ┌────────────────────────────┐
              │ Stage 6  DecisionRecord    │ → audit DB + WebSocket
              └────────────────────────────┘   + Intelligence Panel
```

---

## 5. Stage specifications

### Stage 0 — Normalize + Pre-scan
Lowercase, strip, collapse whitespace, extract URLs / file refs / code fences.

Run MATRIX's prompt-injection scan **here**, not after planning. The document places MATRIX
after the planner (Ch. 4.6), but classification reads raw user text — an injection payload can
steer the classifier into selecting a privileged agent before any security gate runs.

### Stage 1 — Signal Extraction
Four independent extractors, each returning `Dict[intent, score]`. Ported from #2.

| Extractor | Weight | Detects |
|---|---|---|
| `domain_detector` | 0.50 | subject field — research, software, finance, docs |
| `entity_extractor` | 0.25 | nouns/objects — "dashboard", "PDF", "API", filenames |
| `objective_detector` | 0.15 | goal form — build / analyze / explain / compare |
| `action_extractor` | 0.10 | imperative verbs — create, find, refactor, summarize |

Independent extractors fix the `find`-beats-`python` bug: `python` scores on domain (0.50) and
outweighs `find` on action (0.10).

### Stage 2 — Intent Voting
```python
score[intent] = (domain[i]*0.50 + entity[i]*0.25
                 + objective[i]*0.15 + action[i]*0.10)
```
Return the **full distribution**, not just the winner — Stage 3 needs it.

### Stage 3 — Confidence
```python
margin     = winner - runner_up
confidence = clamp(55, 95, int(margin / winner * 100) + 70)
```

| Tier | Range | Meaning |
|---|---|---|
| HIGH | ≥ 75 | proceed |
| MEDIUM | 55–74 | proceed with guard rails |
| LOW | < 55 | do not act — clarify |

### Stage 3b — LLM Escalation (tier 2)
When `confidence < 75`, call a small fast model with structured output. **This is the ported
Genkit flow** — its schema is already correct and already produces governance signals,
human-impact flags, risk level, clarity, evidence and reasoning. Port the schema and prompt
to Python/Pydantic; do not rewrite it.

Confidence is a *control signal*: the cheap path stays free, the expensive path is bought only
on ambiguous prompts. This is how Ch. 4.8's "reduced execution cost" is actually delivered.

Still < 55 after tier 2 → CLARIFY.

### Stage 4 — Complexity Scoring
Independent of intent. Maps onto the four parameters named in Ch. 4.5.

| Factor | Weight | Signals | Ch. 4.5 |
|---|---|---|---|
| `step_estimate` | 0.30 | verb count, conjunctions, enumerations, "then/after/and" | Request Complexity |
| `resource_need` | 0.25 | browser, filesystem, DB, API, code execution | Resource Requirement |
| `output_artifact` | 0.20 | chat answer vs report/PDF/deck/dashboard/multi-file | Output Type |
| `context_volume` | 0.15 | prompt length, attachment count, referenced docs | — |
| `duration_class` | 0.10 | immediate vs long-running | Execution Time |

| Band | Score | Route |
|---|---|---|
| TRIVIAL | 0–19 | CHAT |
| SIMPLE | 20–39 | CHAT |
| MODERATE | 40–59 | threshold — planning begins |
| COMPLEX | 60–79 | MISSION |
| MULTI_PHASE | 80–100 | MISSION + HITL |

Separates "Explain Python" (TRIVIAL) from "Refactor this service" (COMPLEX) — both CODING.
Fixes 2.3: "Research About Quantum Computing" scores `resource_need` (browser/search) and
`output_artifact` (report) → MODERATE/COMPLEX, not LOW.

### Stage 5 — Routing Matrix

**Low confidence never proceeds to an expensive or irreversible path.**

| | LOW conf (<55) | MEDIUM (55–74) | HIGH (≥75) |
|---|---|---|---|
| **TRIVIAL / SIMPLE** | CLARIFY | CHAT | CHAT |
| **MODERATE** | CLARIFY | CHAT + confirm | MISSION |
| **COMPLEX** | CLARIFY | MISSION + HITL | MISSION |
| **MULTI_PHASE** | CLARIFY | MISSION + HITL | MISSION + HITL |

The dangerous quadrant is low-confidence × high-complexity — about to spend real compute and
take real actions on a guess. That cell asks a question. It is also the natural handoff into
HELIX's human-in-the-loop path.

### Stage 6 — DecisionRecord

Superset of the Genkit output and the Intelligence Panel's needs. One contract, consumed by
the panel, the planner, HELIX, MATRIX, the audit DB and the dashboard.

```python
class DecisionRecord(BaseModel):
    decision_id: str
    mission_id: str | None
    trace_id: str

    # ── intent ──────────────────────────────────
    intent: IntentType
    intent_label: str                    # panel: "Research & Analysis"
    secondary_intents: list[str]
    intent_scores: dict[str, float]      # full distribution
    domain: str
    objective: str
    entities: list[str]
    actions: list[str]

    # ── confidence ──────────────────────────────
    confidence: int                      # 0-100, panel bar
    confidence_tier: ConfidenceTier
    clarity_score: int                   # from intelligence-kernel
    clarity_rating: str

    # ── complexity ──────────────────────────────
    complexity_score: int                # 0-100
    complexity_band: ComplexityBand      # panel segments
    complexity_factors: dict[str, float] # per-factor breakdown
    estimated_steps: int

    # ── governance handoff (HELIX) ──────────────
    risk_level: str
    risk_reason: str
    authority_level: int
    human_impact: HumanImpact            # employment/finance/health/edu/legal/safety
    governance_signals: GovernanceSignals

    # ── routing ─────────────────────────────────
    resources: list[Capability]
    execution_mode: ExecutionMode        # CHAT | MISSION | CLARIFY
    mode_source: ModeSource              # AUTO | USER_OVERRIDE
    requires_planning: bool
    requires_hitl: bool
    clarifying_question: str | None
    suggested_agents: list[AgentSuggestion]

    # ── panel estimates ─────────────────────────
    estimated_duration: str              # panel: "~2 min"
    estimated_cost: str                  # panel: currently always $0.00

    # ── provenance ──────────────────────────────
    classifier_tier: int                 # 1 heuristic, 2 LLM
    latency_ms: int
    evidence: list[str]
    reasoning: list[str]                 # human-readable trace
```

`reasoning`, `evidence` and `intent_scores` make Chapter 4's transparency claim
**demonstrable** rather than rhetorical.

### Stage 7 — Post-plan Re-evaluation
Pre-plan complexity is an estimate; the planner returns the real DAG. If actual steps exceed
the estimate materially, re-enter the router — which can upgrade MISSION to MISSION + HITL
mid-flight. The document has no feedback edge; this stops a MODERATE-looking request from
silently becoming a 40-step unsupervised run.

---

## 6. Where it runs

The engine belongs in **FastAPI**, not the Next tier:

- HELIX, MATRIX, the planner and the audit DB all live there
- `POST /api/mission` must be authoritative even when called directly, not only through the UI
- browser-computed governance signals are advisory at best and trivially bypassed

The Next tier keeps the two-tier *feel*:

```
keystroke ──► localFastAnalysis()      instant, optimistic paint (fixed heuristic)
   1200ms ──► POST /api/decision       real engine, replaces the paint
   launch ──► POST /api/mission {decision_id}   backend reuses, does not re-derive
```

Passing `decision_id` at launch is what closes defect 2.1.

---

## 7. File layout

```
nexus-backend/app/services/decision/
├── __init__.py
├── decision_service.py        # orchestrates stages 0-6
├── signals/
│   ├── domain_detector.py     # PORT from intent_engine/
│   ├── entity_extractor.py    # PORT
│   ├── objective_detector.py  # PORT
│   └── action_extractor.py    # PORT
├── intent_voter.py            # PORT (weighted formula)
├── confidence.py              # PORT + tier bands
├── complexity.py              # NEW — 5-factor scorer
├── router.py                  # NEW — the matrix
├── llm_classifier.py          # PORT from natural-language-mission-intake.ts
├── intelligence_kernel.py     # PORT from helix/intelligence-kernel.ts
└── models.py                  # DecisionRecord, enums
```

`app/services/intent/` collapses into this. `ExecutionModeRouter` is replaced by `router.py`.
`CapabilityService` is called from Stage 4 (`resource_need`).

---

## 8. Execution order

| # | Step | Acceptance criteria |
|---|---|---|
| 1 | **Eval harness first** — Ch. 4.5 table as a pytest fixture, expanded to ~40 labelled prompts | prints the accuracy table; current backend scores 50% |
| 2 | **Stop discarding the analysis** — fix `page.tsx:366` to pass real complexity/confidence | DB rows show varying values, not `"Low", 70` |
| 3 | Port `intent_engine/` → `services/decision/signals/` + `intent_voter.py` | harness ≥ 85% intent accuracy |
| 4 | Real `confidence.py` — margin-based + tiers; delete the hardcoded `1.0` | ambiguous prompts score < 75 |
| 5 | `complexity.py` — 5 factors + bands | "Explain Python" TRIVIAL; "Research About Quantum Computing" ≥ MODERATE |
| 6 | `router.py` — confidence × complexity matrix | all 8 Ch. 4.5 examples route correctly; harness ≥ 90% |
| 7 | `DecisionRecord` + `POST /api/decision` | returns every panel field |
| 8 | Point the panel at `/api/decision`; fix `localFastAnalysis` confidence | no 17% → 85% jump; one engine of record |
| 9 | `POST /api/mission {decision_id}` — backend stops re-deriving | one classification per mission, end to end |
| 10 | Emit DecisionRecord to audit DB + WebSocket | dashboard renders live intent/confidence/complexity |
| 11 | Port Genkit flow → `llm_classifier.py` as tier-2 escalation | tier-1 hit rate logged; low-confidence prompts upgrade |
| 12 | CLARIFY path — return question, resume on answer | ambiguous prompt asks instead of guessing |
| 13 | Mode toggle → `AUTO` default, override recorded | `mode_source` populated in DecisionRecord |
| 14 | Stage 0 MATRIX pre-scan | injection payload blocked before classification |
| 15 | Stage 7 post-plan re-evaluation | underestimated mission escalates to HITL |

Steps **1–2 are the unblockers** — the harness makes progress measurable, and step 2 alone
makes the existing panel real. 3–6 are the engine. 7–9 unify the four implementations into
one. 10–15 are transparency and hardening.

---

## 9. Relationship to the alignment plan

- **Revises Phase A** — port `intent_engine/` *and* the Genkit flow before archiving either tree.
- **Feeds Phase B** — `DecisionRecord` is what `GET /api/dashboard` returns for the decision stage.
- **Feeds Phase C** — every DecisionRecord is an audit row; the first real writer to the audit DB.
- **Feeds Phase D** — Stage 6 emits the first genuine WebSocket stage event.
- **New doc gap** — Citadel appears in the UI but in no chapter.
