"""
Tier-2 plan enrichment.

The deterministic planner decomposes from templates: reproducible, but blind
to anything its rules do not encode. The model reads the same prompt and
proposes steps the templates missed.

Two constraints keep this safe:
  * Risk is re-derived, never accepted. Each proposed step is mapped back
    through the operation registry, so a step the model labels harmless still
    inherits the risk surface of the operation it names.
  * It is additive. Deterministic steps are never dropped or reordered;
    enrichment only appends, and only when the model is reachable.

Enrichment runs only when the deterministic plan looks thin compared with the
Decision Engine's own estimate.
"""


import logging
from typing import List, Optional

from pydantic import BaseModel, Field

from app.services.llm import llm_available, structured_call

from .models import OperationType, Plan, PlanStep
from .operations import spec

logger = logging.getLogger(__name__)

VALID_OPS = ", ".join(o.value for o in OperationType)

SYSTEM = f"""You decompose software missions into concrete execution steps for an \
autonomous agent platform.

Return steps that describe the ACTUAL work the request implies. Be specific to \
the request: "Fix a typo in the README" and "Migrate a project to TypeScript" \
must not produce similar step lists.

Each step's `operation` MUST be exactly one of: {VALID_OPS}

Rules:
- Name the operation that genuinely happens. If a step deletes data, say \
DATABASE_DELETE or DELETE_FILE. Never soften a destructive operation.
- Distinguish an operation THIS platform performs right now, executing the \
mission, from a feature being written into code that an application's own \
future end users would use. "Build a to-do app where users can delete tasks" \
means write the delete-task code -- that step is IMPLEMENT. It is not \
DATABASE_DELETE/DELETE_FILE, because nothing is actually being deleted by \
this mission; a real delete/send/deploy operation is only ever one this \
platform itself carries out directly (e.g. the mission explicitly asks to \
delete a real file, drop a real table, or send a real email right now).
- `depends_on` refers to `step_id` values you have already emitted.
- Prefer fewer, meaningful steps over many trivial ones.
- Do not invent work the user did not ask for."""


class LLMStep(BaseModel):
    step_id: str = Field(description="Short unique id, e.g. 'a1'")
    action: str = Field(description="Short imperative, e.g. 'Configure TypeScript'")
    description: str
    purpose: str = Field(description="Why this step is needed")
    operation: str = Field(description="One of the allowed operation names")
    inputs: List[str] = Field(default_factory=list)
    expected_output: str = ""
    depends_on: List[str] = Field(default_factory=list)


class LLMPlan(BaseModel):
    steps: List[LLMStep]
    rationale: str = Field(description="One sentence on the decomposition chosen")


def should_escalate(plan: Plan) -> bool:
    """
    Escalate only when the deterministic decomposition looks thin: the Decision
    Engine predicted materially more work than the templates produced. There is
    nothing to gain from a model call on a plan that is already proportionate.
    """
    if not llm_available():
        return False
    if not plan.steps:
        return True
    return plan.estimated_steps - plan.actual_steps >= 3


def enrich(plan: Plan, prompt: str) -> Plan:
    """Append model-proposed steps to a deterministic plan. Never removes any."""
    if not should_escalate(plan):
        return plan

    existing = "\n".join(f"- {s.action} ({s.operation.value})" for s in plan.steps)
    result = structured_call(
        system=SYSTEM,
        prompt=(
            f"Mission: {prompt}\n\n"
            f"Assessed complexity: {plan.complexity}\n"
            f"A rule-based planner produced these steps:\n{existing or '(none)'}\n\n"
            f"Decompose the mission properly. Include the steps above where they "
            f"are right, and add what they miss."
        ),
        schema=LLMPlan,
        effort="medium",
    )

    if result is None or not result.steps:
        plan.notes.append("Tier-2 planning unavailable; deterministic plan retained")
        return plan

    known = {s.step_id for s in plan.steps}
    added = 0
    id_map = {}

    for llm_step in result.steps:
        try:
            op = OperationType(llm_step.operation.strip().upper())
        except ValueError:
            logger.warning("Discarding step with unknown operation: %s",
                           llm_step.operation)
            continue

        # Skip anything the deterministic planner already covers.
        if any(s.action.lower() == llm_step.action.lower() for s in plan.steps):
            continue

        new_id = f"L{added + 1}"
        id_map[llm_step.step_id] = new_id

        # Risk is taken from the registry, never from the model's own claim.
        s = spec(op)
        plan.steps.append(PlanStep(
            step_id=new_id,
            action=llm_step.action,
            description=llm_step.description,
            purpose=llm_step.purpose,
            operation=op,
            capability=s.capability.value,
            tool=s.tool,
            inputs=list(llm_step.inputs),
            expected_output=llm_step.expected_output,
            depends_on=[id_map[d] for d in llm_step.depends_on if d in id_map]
                       + [d for d in llm_step.depends_on if d in known],
            risk_surface=s.risk,
            reversible=s.risk.reversible,
            requires_human_approval=s.requires_human_approval,
            validation=s.default_validation,
            failure_strategy=s.failure_strategy,
        ))
        added += 1

    if added:
        # Recompute the summary so newly added risk reaches governance.
        summary = plan.risk_summary
        for s in plan.steps:
            summary = summary.union(s.risk_surface)
        plan.risk_summary = summary
        plan.required_capabilities = sorted({s.capability for s in plan.steps})
        plan.notes.append(f"Tier-2 planning added {added} step(s): {result.rationale}")

    return plan
