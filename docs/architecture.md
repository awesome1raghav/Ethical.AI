# EthicalAI — Current Architecture

**Scope of this document:** architecture and behavior only — no API names, model
names, vendors, or tool identifiers. Every claim below was verified by reading
the current source, not from memory of what was intended. Where behavior is
genuinely implemented, it is marked **IMPLEMENTED**. Where it is designed but
not wired up, or absent entirely, it is marked **NOT IMPLEMENTED** or **GAP**.

This is a documentation snapshot. No code was changed to produce it.

---

## 1. Complete Current Execution Flow

```
User Prompt
    │
    ▼
Pre-Scan (security)                          — IMPLEMENTED
    │  blocks unsafe prompts before classification, on every path
    ▼
Guardrails Input Rail                        — IMPLEMENTED
    │  model-based policy check (harm, jailbreak, exfiltration, fraud),
    │  on every path; chat replies also pass an output rail
    ▼
Intent / Confidence / Complexity Classification — IMPLEMENTED
    │
    ├── Ambiguous ───────────────► Clarify (ask the user)      — IMPLEMENTED
    │
    ├── Conversational ──────────► Direct Response             — IMPLEMENTED
    │                               (plan-level governance below is
    │                                not entered on this path — see §9)
    │
    └── Actionable ──────────────► Mission Path
                                        │
                                        ▼
                              Capability Detection              — IMPLEMENTED
                                        │
                                        ▼
                              Step Breakdown (Planner)           — IMPLEMENTED
                                        │
                                        ▼
                              Optional Step Enrichment           — IMPLEMENTED
                              (adds steps a rule-based
                               breakdown missed; never
                               removes or reorders any)
                                        │
                                        ▼
                              Governance Evaluation (risk + policy) — IMPLEMENTED
                                        │
                          ┌─────────────┼──────────────┐
                          ▼             ▼              ▼
                       Denied      Needs Human      Approved
                    (no appeal)    Review/Approval  (proceed)
                          │             │              │
                          ▼             ▼              │
                       Blocked    Paused, resumable    │
                                  (see §6)             │
                                        │               │
                                        └───────┬───────┘
                                                ▼
                                     Security Evaluation          — IMPLEMENTED
                                     (of the actual plan, not
                                      just the prompt)
                                                │
                                    ┌───────────┼───────────┐
                                    ▼                       ▼
                                 Blocked                 Cleared
                                    │                       │
                                    ▼                       ▼
                                                    Agent Assignment      — IMPLEMENTED
                                                            │
                                                            ▼
                                                    Per-Step Execution    — IMPLEMENTED
                                                            │
                                        ┌───────────────────┼───────────────────┐
                                        ▼                   ▼                   ▼
                                   Step Succeeds      Step Needs Human      Step Fails
                                        │              Approval              │
                                        ▼                   │                ▼
                                  Next Step          Pause (resumable) Mission Halts
                                        │                   │           (honest failure)
                                        └────────┬──────────┘
                                                 ▼
                                        All Steps Resolved
                                                 │
                                                 ▼
                                        Mission Status Finalized      — IMPLEMENTED
                                        (completed / failed / blocked)
                                                 │
                                                 ▼
                                        Result Rendered by Frontend   — IMPLEMENTED
                                        (reads backend state only)
```

**Verification / proof-of-execution** as a distinct stage does **NOT** exist —
see §8 and §9. A step is recorded "completed" because the agent call returned
without raising, not because anything checked the output against the step's
own stated success criterion.

---

## 2. Layer Responsibilities and Boundaries

| Layer | Responsibility | Boundary begins | Boundary ends |
|---|---|---|---|
| **Pre-Scan** | Reject unsafe prompt content before anything trusts the text | Raw user prompt | Emits a block, or passes through unchanged |
| **Understanding** (intent/confidence/complexity) | Decide *what kind* of request this is, *how much* work it implies, and *how sure* the system is | Scanned prompt | A single decision record: intent, confidence, complexity, routing outcome |
| **Capability Detection** | Translate intent into the general categories of ability the mission will need | Decision record | A list of capability categories (not yet concrete steps) |
| **Planner** | Turn the prompt + decision into concrete, ordered, typed steps with declared risk | Capabilities + decision | A structured plan: steps, dependencies, per-step risk, deviation from the original estimate |
| **Step Enrichment** | Add steps a rule-based breakdown could plausibly have missed | A generated plan | The same plan, only ever with steps appended, never altered or removed |
| **Governance (risk/policy)** | Decide whether the *plan* — not the prompt — is allowed to run, and whether a human must be involved | A structured plan | One of: denied / needs-approval / approved, with a stated reason |
| **Security Evaluation** | Inspect the plan's actual declared operations and the prompt for unsafe patterns | An approved-so-far plan | Cleared, or blocked, with reasons |
| **Agent Assignment** | Map each step's declared operation to the kind of worker responsible for it | A cleared plan | A worker assignment per step |
| **Per-Step Execution** | Actually perform one step's work, and record exactly what happened | One step + everything completed before it | A real success/failure outcome for that one step |
| **Mission State** | Own the single, persisted, canonical record of what has happened to this mission | Every layer above | Read by every layer below |
| **Frontend** | Render mission state; collect human approval decisions | Persisted mission state | Nothing — it does not decide anything itself |

The important boundary: **governance evaluates the plan, not the prompt.**
Everything from Planner onward operates on typed, structured steps with
declared properties (what the step does, whether it can be undone, whether it
reaches outside the system). Nothing after the Planner stage reasons about the
original free-text prompt directly except the security layer, which
deliberately inspects both.

---

## 3. Dynamic Step Generation and Agent Assignment

**IMPLEMENTED**, and genuinely dynamic — not template lookup.

Step generation does not select from a fixed list of steps per intent
category. It:

1. Segments the prompt into distinct task clauses.
2. Classifies each clause into one of a fixed set of declared *operation
   types* (each operation type has a predeclared risk profile — see §5).
3. Expands each classified clause into concrete sub-steps, and the *shape* of
   that expansion depends on the assessed complexity of the request — a
   trivial edit expands into a short, linear sequence; a substantial build
   expands into analysis → design → implementation → validation → testing,
   with real parallel branches where steps don't depend on each other.
4. Builds dependency edges between steps from *declared data flow* (which step
   produces something a later step consumes) — not from step order. This is
   what produces genuine parallel branches rather than a straight line.
5. Compares the resulting step count against what the understanding stage
   estimated, and records the deviation and a stated reason for it.

**Two structurally different missions do not receive the same plan shape.**
A one-line fix and a multi-part build produce visibly different step counts,
different operation types, and different dependency graphs.

**Agent assignment** is a direct, declared mapping: every operation type an
individual step can carry has exactly one worker-category responsible for it.
Assignment is computed *from the step's operation*, not from the mission's
overall intent category — so two steps in the same mission that need
different kinds of work are assigned differently.

**NOT IMPLEMENTED:** a learned or adaptive step-generation model. The
decomposition logic is rule-based, not model-driven, by explicit design
choice (see §9 for where a secondary, bounded model-assisted enrichment step
fits in).

---

## 4. How an Individual Step Moves Through Execution

**IMPLEMENTED.** For a given step, in order:

1. **Skip check** — if this exact step already has a recorded outcome (from an
   earlier run, before a pause), it is not touched again. This is what makes
   resume safe: nothing already done is redone.
2. **Approval gate** — if this step is declared to need human approval and no
   explicit approval has been recorded for it, execution stops *here*.
   Nothing after this step is touched. Everything before it, in the same run,
   already has its real recorded outcome.
3. **Assignment lookup** — the worker category responsible for this step's
   operation is resolved. If none is registered, the mission halts with an
   explicit, honest reason naming the missing capability. It does not skip
   the step and continue.
4. **Execution attempt** — the assigned worker is invoked with exactly this
   step's declared description, purpose, and expected output, plus the real
   recorded outputs of every step that ran before it in this same mission.
5. **Outcome recording** — exactly one of three things is recorded, and it is
   never fabricated:
   - a real output, if the worker completed the step
   - a real, specific error, if the worker could not honestly perform it
   - a real, specific error, if the operation has no capability configured to
     perform it at all (distinct from a worker malfunctioning)
6. **Continue or halt** — on success, execution moves to the next step. On
   failure (either kind above) or a new approval gate, the mission stops and
   its status reflects exactly which of those happened and why.

A step's recorded state is one of: not yet reached, completed, failed, or
paused for approval. There is no partial or ambiguous state.

---

## 5. Failure Propagation

All of the following are **IMPLEMENTED** as distinct, distinguishable
outcomes — none of them currently share a code path with a different one.

| Failure type | What triggers it | What happens |
|---|---|---|
| **Agent failure** | The assigned worker was invoked and could not complete the step (including being unable to reach the capability it depends on) | That step is recorded failed with the real reason. The mission halts. Nothing after it runs. |
| **Missing agent** | A step's operation resolves to a worker category with no implementation registered at all | The mission halts immediately with an explicit reason naming the missing capability. This is treated as distinct from an agent that ran and failed. |
| **Capability unavailable** | The assigned worker recognizes the operation but has no real means to perform it (e.g., an operation that would require executing something, or reaching an external system, that is not configured) | The worker declines explicitly rather than fabricating a result. Recorded as a real failure with a specific reason, not a generic error. |
| **Governance denial** | The plan contains an operation policy has decided is not approvable at all | The mission halts before any step executes. This is a terminal state, not currently resumable (see §9). |
| **Human approval required** | A specific step is declared to require approval, or the mission overall was assessed as needing a check-in before proceeding | Execution pauses exactly at that point. See §6. |
| **Resume** | An explicit approval is recorded for a paused mission | Execution continues from exactly the paused point. Already-completed steps are not repeated. |
| **Replanning** | — | **NOT IMPLEMENTED.** There is no automatic replanning when a capability is missing or a step fails. The mission halts and stops; nothing currently regenerates an alternative plan or substitutes an alternative approach automatically. |

**Nothing in the current system silently continues past a failure it detects.**
Detected failures are terminal for that run (until an explicit resume, where
applicable). The gap is upstream of detection, not in what happens after
detection — see §9 for what can currently go undetected.

---

## 6. Human-in-the-Loop Architecture

**IMPLEMENTED**, with one significant asymmetry documented below.

There are **two distinct places** execution can pause for a human, and they
are not the same mechanism:

### 6.1 Whole-mission pause (before any step runs)
Triggered when the overall assessed risk of the *plan* warrants a check-in
before any work begins, or when a plan-wide policy concern is found that is
serious but not an outright denial. At this point no step has executed yet.

### 6.2 Per-step pause (mid-execution)
Triggered when execution reaches a *specific* step that is individually
declared to require approval. Everything before that step has already run for
real and has real recorded outcomes. Nothing after it has been touched.

**Both pauses are resumable through the same mechanism**, provided a
persisted record of the mission's plan and progress exists (see below).
Resuming re-enters step execution exactly where it left off: already-completed
steps are recognized and skipped; the just-approved step (or, for a
whole-mission pause, the first step) is attempted for real; execution
continues until either completion, another approval gate, or a real failure.

**Approval is never inferred from silence.** A step or mission is only ever
marked approved by an explicit, separate approval action being recorded.
Absence of a response leaves it paused indefinitely — there is currently no
automatic timeout, reminder, or expiry (see §9).

**Cancellation:** stepping away from a paused mission does not communicate a
cancellation to the backend. It simply stops being watched by that particular
view. Nothing currently marks a mission as deliberately abandoned.

**Asymmetry (GAP):** the whole-mission pause (§6.1) is only resumable when it
occurs *after* a plan has already been generated. A specific, narrower kind of
whole-mission pause that can occur *before* a plan exists is currently
**not resumable at all** — see §9 for the precise condition.

---

## 7. How the Frontend Obtains and Displays Backend Truth

**IMPLEMENTED**, and this is now a single-direction relationship: the backend
owns state, the frontend reads and renders it.

1. When a mission is launched, the frontend sends the prompt to the backend
   and receives back the *real, already-computed* result — because the
   backend evaluates understanding, planning, and governance, and attempts
   whatever execution it can, synchronously within that same request. There
   is no separate "in progress, come back later" state during this first
   request — by the time a response comes back, the backend has already gone
   as far as it is currently able to.
2. The frontend persists a pointer to that mission and navigates to the
   execution view.
3. The execution view asks the backend, directly, for that mission's current
   real state — the same state a fresh observer would see. It does not trust
   or reconstruct anything locally.
4. Every step shown, every status shown, and every approval gate shown is
   copied directly from that response. The frontend does not independently
   decide that a step succeeded, failed, or needs approval.
5. When a human approves a paused mission, the frontend sends that single
   approval action to the backend and, again, renders exactly whatever real
   state comes back — which may itself be "paused again, at a later step."

**NOT IMPLEMENTED:** live, continuous streaming of progress *during* a single
execution attempt. Because a mission attempt currently runs to completion (or
to its next real pause point) synchronously within one backend request, there
is nothing generated mid-flight for a stream to carry. The frontend's picture
of "current state" is only ever as fresh as the last request/response — accurate,
but not continuously live.

---

## 8. Current Verification Mechanism

This is the most important section to be precise about.

**What exists:** each step declares, as part of its plan, a stated criterion
for what would make it genuinely correct (a description of what should be
true if the step worked). Each step also declares whether it is reversible
and what kind of operation it performed.

**What does NOT exist:** nothing currently checks a step's real output
*against* that stated criterion. "Completed" is recorded when the assigned
worker's call returns without error — not because anything has confirmed the
output is correct, complete, or matches what was asked for.

Put plainly: **the current system trusts that a worker call which did not
raise an error produced a genuinely correct result.** It does not currently
independently verify that claim for any step. This applies whether the worker
performing the step is a model-backed one or a deterministic one — a
deterministic worker's real, honest output is still not compared against the
step's own success criterion; only whether it *ran* is checked, not whether it
*succeeded* at the specific thing that was asked.

What the system *does* correctly guarantee, and this is real:

- a step recorded "completed" genuinely executed — it is not a placeholder
- a step's real output or real error is what is shown — nothing is invented
  to fill in for a step that did not actually run
- an operation the system has no real way to perform is refused rather than
  faked

What it does **not** guarantee: that a step recorded "completed" actually
achieved its stated purpose. There is a real difference between "this ran
without error" and "this is correct," and only the former is currently
checked.

---

## 9. Remaining Architectural Gaps

Ranked by how directly each one could still let something fabricate, skip, or
misreport.

### 9.1 No output verification against stated success criteria — GAP
Covered fully in §8. This is the largest remaining gap: a step can complete
"successfully" while not actually having achieved what it was meant to.
Nothing currently closes this loop.

### 9.2 Conversational path skips plan-level governance — PARTIAL GAP
A request classified as conversational is answered directly. It still passes
the security pre-scan and the guardrails input rail (and, for chat replies,
the output rail), so unsafe prompts and replies are caught on this path. What
it does not enter is plan-level governance (§2): there is no plan, so the
policy and risk engines have nothing to evaluate. A request misclassified as
conversational is therefore screened for safety but not for operational risk.

### 9.3 A declared "needs review" signal on the conversational path is not actually acted on — GAP
The understanding stage can flag a request as needing a human check-in even
while classifying it as conversational. That flag is currently never read on
the conversational path — the response is still generated immediately. The
flag is real; the enforcement of it, for this one specific combination, does
not currently exist.

### 9.4 One category of whole-mission pause has no resume path — GAP
A whole-mission pause that occurs *before a plan has been generated* — as
opposed to one occurring after a plan exists, which is fully resumable — is
not currently persisted. If that specific pause occurs, there is presently no
way to approve past it and continue; the only path forward is starting over.
This is narrower than it sounds (most missions that reach a pause do so after
a plan exists, which is resumable) but it is a real, current gap for the ones
that don't.

### 9.5 No automatic timeout or expiry on a pending approval — GAP
A paused mission waits indefinitely. There is no reminder, no automatic
expiry, and no automatic fallback behavior for an approval that is never
given. It simply stays paused until someone acts or abandons it.

### 9.6 No automatic replanning on failure — GAP (by current design, not oversight)
When a step fails or a required capability is missing, the mission halts.
Nothing currently attempts an alternative approach, substitutes a different
method, or regenerates the plan around the gap. This may be intentional
conservatism rather than a defect, but it means "the system tried a different
way" is not something that currently happens.

### 9.7 Optional step enrichment introduces an unverified secondary path — GAP (bounded)
The step-enrichment stage mentioned in §1/§3 can append steps a rule-based
breakdown missed. Anything it proposes is filtered to only recognized,
declared operation types before being added, and its declared risk is always
taken from that operation's fixed profile — never from anything it claims
about itself. So a proposed step cannot introduce an undeclared risk. It
*can*, however, still be subject to the same §9.1 gap: an appended step is
verified no more rigorously than any other step once it's part of the plan.

### 9.8 Cancellation is cosmetic — minor GAP
Stepping away from a paused mission does not tell the backend anything.
Nothing currently distinguishes "the user is still deciding" from "the user
walked away for good." A stale paused mission looks identical to a mission
someone is about to approve.

### What is explicitly **not** a gap, verified directly:
- A missing worker implementation halts the mission with a named reason — it
  does not skip silently. *(Verified against the exact prior failure mode:
  earlier in this system's history, a missing implementation was silently
  skipped with no error and no trace; that specific failure mode has been
  closed.)*
- An operation the system cannot really perform is refused with a specific
  reason rather than a fabricated success. *(Also directly closed against a
  prior, verified failure mode of the same shape.)*
- A step's real output/error is what reaches the display layer — the display
  layer does not independently reinterpret, upgrade, or invent step outcomes.
- Truly irreversible, high-severity operations still require an upfront,
  affirmative check before any step of the mission runs at all.

---

## 10. Step-by-Step Execution Sequence

For documentation purposes — this reflects the real current sequence for a
mission that runs cleanly through to a mid-mission approval pause and resume,
which exercises every real stage in this document.

```
1.  User submits a request.
2.  Security pre-scan runs against the raw prompt.
        └─ if unsafe: STOP. Mission blocked. No further stage runs.
3.  Intent, confidence, and complexity are classified together.
4.  Routing decision is made: conversational / needs clarification / actionable.
        └─ if needs clarification: STOP. The system asks a question instead
           of guessing.
        └─ if conversational: a direct response is produced. (Governance and
           security evaluation of the mission-execution kind are not entered
           on this path — see §9.2/§9.3.)
5.  [Actionable path continues]
    General capabilities implied by the intent are identified.
6.  The request is broken into concrete, typed, ordered steps, with
    dependencies derived from what each step actually needs from another.
7.  A bounded, optional pass may append steps the rule-based breakdown
    plausibly missed. Nothing existing is altered or removed by this pass.
8.  The real step count is compared against the original estimate, and any
    material difference is recorded with a stated reason.
9.  If no actionable step resulted at all: STOP. The system reports that
    plainly rather than reporting false success.
10. Governance evaluates the plan's actual declared operations and their risk.
        └─ if an operation is judged non-approvable outright: STOP. Mission
           blocked. (Not currently resumable in every case — see §9.4.)
        └─ if the plan as a whole needs a human check-in before proceeding:
           PAUSE here. Nothing has executed yet. This pause is recorded and
           resumable, provided a plan already exists (see §9.4 for the one
           case where it is not).
11. [If not paused] Security evaluation inspects the plan's real operations
    and the prompt.
        └─ if blocked: STOP. Mission blocked.
12. Each step is assigned to the worker category responsible for its specific
    declared operation.
13. Execution proceeds step by step, in dependency order:
        for each step not yet resolved:
            if this step individually requires approval and none is recorded:
                PAUSE here. Everything before this step has already run for
                real. Nothing after it has been touched. This state is
                recorded and resumable.
            else:
                the assigned worker attempts the step for real
                if no worker is registered for what this step needs:
                    STOP. Mission halted with the specific missing
                    capability named. Not silent.
                if the worker cannot honestly perform the operation:
                    STOP. Mission halted with the specific, real reason.
                    Nothing fabricated in its place.
                if the worker succeeds:
                    the real output is recorded; continue to the next step
14. [Resume, if paused at step 13] An explicit approval is recorded for
    exactly the step that was pending. Execution re-enters step 13 from
    exactly that point — steps already resolved are recognized and are not
    repeated.
15. Once every step is resolved (or the mission has halted), the mission's
    final status is set to exactly one of: completed, failed, or blocked —
    reflecting what genuinely happened, not an assumed outcome.
16. The frontend, on its own request, reads this exact final state from the
    backend and renders it as-is. It does not compute or infer any part of
    this outcome itself.
```

---

## Summary Table — Implemented vs Not Implemented

| Capability | Status |
|---|---|
| Prompt-level security pre-scan on every path | IMPLEMENTED |
| Combined intent / confidence / complexity understanding | IMPLEMENTED |
| Ask-for-clarification path for ambiguous requests | IMPLEMENTED |
| Dynamic, non-templated step breakdown | IMPLEMENTED |
| Dependency graph from real data flow (genuine parallel branches) | IMPLEMENTED |
| Deviation-from-estimate tracking with a stated reason | IMPLEMENTED |
| Bounded, filtered, risk-safe step enrichment | IMPLEMENTED |
| Governance evaluation of the actual plan (not just the prompt) | IMPLEMENTED |
| Security evaluation of the actual plan | IMPLEMENTED |
| Per-step, operation-driven worker assignment | IMPLEMENTED |
| Real per-step execution with genuine success/failure | IMPLEMENTED |
| Distinct handling: agent failure vs. missing agent vs. capability unavailable | IMPLEMENTED |
| Whole-mission approval pause (post-plan) | IMPLEMENTED, resumable |
| Whole-mission approval pause (pre-plan) | IMPLEMENTED, **not resumable** — GAP |
| Per-step approval pause | IMPLEMENTED, resumable |
| Resume from exact pause point without repeating completed steps | IMPLEMENTED |
| Persisted, checkpointed mission state | IMPLEMENTED (for post-plan states) |
| Frontend renders backend truth only, no local fabrication | IMPLEMENTED |
| Live/streaming progress during one execution attempt | NOT IMPLEMENTED |
| Output verification against a step's own success criterion | NOT IMPLEMENTED |
| Governance/security evaluation on the conversational path | NOT IMPLEMENTED |
| Enforcement of a "needs review" flag on the conversational path | NOT IMPLEMENTED |
| Automatic approval timeout / expiry / reminder | NOT IMPLEMENTED |
| Automatic replanning after failure or missing capability | NOT IMPLEMENTED |
| Real cancellation (backend-recorded abandonment) | NOT IMPLEMENTED |
