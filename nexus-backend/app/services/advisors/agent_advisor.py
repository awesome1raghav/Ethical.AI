"""
On-demand agent recommendation.

Called when the user asks for it (a POST, not polled). The model sees the
generated plan, the HELIX and MATRIX verdicts, and the registry of available
agents, and matches work to capability with a justification. The
deterministic assignment from AgentFactory remains the floor: a
recommendation can add or re-rank agents but never leave a step unassigned.
"""


import logging
from typing import Dict, List, Optional

from pydantic import BaseModel, Field

from app.services.llm import llm_available, structured_call

logger = logging.getLogger(__name__)

SYSTEM = """You assign specialist agents to the steps of an execution plan.

You are given the plan, the governance and security assessments of that plan, and \
the agents available. Match each agent to the work it is genuinely suited for and \
say why in one sentence.

Only recommend agents from the provided list. If a step's work has no good match, \
say so in `gaps` rather than forcing an assignment.

Where governance or security flagged a concern, note which agent carries the \
responsibility for handling it."""


class AgentRecommendation(BaseModel):
    agent: str = Field(description="Exact agent name from the available list")
    steps: List[str] = Field(description="step_ids this agent should handle")
    rationale: str = Field(description="One sentence on why this agent fits")
    confidence: str = Field(description="HIGH, MEDIUM or LOW")


class AgentPlan(BaseModel):
    recommendations: List[AgentRecommendation]
    gaps: List[str] = Field(default_factory=list,
                            description="Work with no suitable agent")
    summary: str


def recommend_agents(plan, prompt: str, helix, matrix,
                     deterministic: Dict[str, str]) -> Optional[dict]:
    """
    Return a recommendation payload, or None when the model is unreachable,
    in which case the caller shows the deterministic assignment on its own.
    """
    if not llm_available() or not plan.steps:
        return None

    from app.services.agent_registry.agent_models import AgentType

    available = "\n".join(f"  - {a.value}" for a in AgentType)

    steps = "\n".join(
        f"  [{s.step_id}] {s.action} — op={s.operation.value}"
        f"{' — ' + ', '.join(s.risk_surface.active) if s.risk_surface.active else ''}"
        f" — currently assigned: {deterministic.get(s.step_id, 'unassigned')}"
        for s in plan.steps
    )

    body = (
        f"Mission: {prompt}\n\n"
        f"Plan ({plan.actual_steps} steps, {plan.execution_strategy.value}):\n{steps}\n\n"
        f"HELIX — decision {getattr(helix.decision, 'value', helix.decision)}, "
        f"risk {getattr(helix.risk, 'value', helix.risk)}: {helix.reason}\n"
        f"MATRIX — {getattr(matrix.security_status, 'value', matrix.security_status)}, "
        f"threat {getattr(matrix.threat_level, 'value', matrix.threat_level)}, "
        f"action {matrix.recommended_action}\n"
        f"Security warnings: {matrix.warnings[:5] or 'none'}\n\n"
        f"Available agents:\n{available}\n\n"
        f"Recommend the agent assignment."
    )

    result = structured_call(SYSTEM, body, AgentPlan, effort="medium")
    if result is None:
        return None

    valid = {a.value for a in AgentType}
    recs = [
        {
            "agent": r.agent,
            "steps": r.steps,
            "rationale": r.rationale,
            "confidence": r.confidence,
        }
        for r in result.recommendations
        if r.agent in valid          # never surface an agent that does not exist
    ]

    return {
        "recommendations": recs,
        "gaps": result.gaps,
        "summary": result.summary,
        "deterministic_assignment": deterministic,
        "source": "llm",
    }
