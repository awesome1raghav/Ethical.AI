"""
POST /api/agents/recommend: user-initiated agent recommendation.

Runs the full deterministic chain (decision -> plan -> HELIX -> MATRIX ->
AgentFactory), then asks the model to review the assignment. If the model is
unreachable, the deterministic assignment is returned with
source="deterministic", so the endpoint always produces an answer.
"""


from fastapi import APIRouter
from pydantic import BaseModel

from app.services.advisors import recommend_agents
from app.services.agent_registry.agent_factory import AgentFactory
from app.services.decision import DecisionService
from app.services.helix.helix_service import HelixService
from app.services.matrix.matrix_service import MatrixService
from app.services.planner.planner_service import PlannerInput, PlannerService
from app.services.validator.request_validator import RequestValidator

router = APIRouter(prefix="/agents", tags=["Agents"])


class RecommendRequest(BaseModel):
    prompt: str


@router.post("/recommend", summary="Recommend agents for a mission")
def recommend(request: RecommendRequest):
    RequestValidator.validate(request.prompt)

    decision = DecisionService.decide(request.prompt)
    plan = PlannerService.generate_plan(
        PlannerInput(prompt=request.prompt, decision_record=decision))

    helix = HelixService.evaluate(plan)
    matrix = MatrixService.evaluate(request.prompt, plan)

    assignments = AgentFactory.assign(plan)
    deterministic = {
        step.step_id: a.agent.value
        for step, a in zip(plan.steps, assignments)
    }

    advice = recommend_agents(plan, request.prompt, helix, matrix, deterministic)

    return {
        "prompt": request.prompt,
        "plan_id": plan.plan_id,
        "steps": plan.actual_steps,
        "helix": {
            "decision": helix.decision.value,
            "risk": helix.risk.value,
            "reason": helix.reason,
            "human_in_loop": helix.human_in_loop,
        },
        "matrix": {
            "status": matrix.security_status.value,
            "threat": matrix.threat_level.value,
            "action": matrix.recommended_action,
            "warnings": matrix.warnings,
        },
        "agents": advice or {
            "recommendations": [
                {"agent": a, "steps": [sid for sid, v in deterministic.items() if v == a],
                 "rationale": "Assigned deterministically from the step's operation.",
                 "confidence": "HIGH"}
                for a in sorted(set(deterministic.values()))
            ],
            "gaps": [],
            "summary": "Model advisory unavailable; deterministic assignment shown.",
            "deterministic_assignment": deterministic,
            "source": "deterministic",
        },
    }
