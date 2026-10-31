from pydantic import BaseModel

from app.services.planner.models import (DependencyEdge, ExecutionStrategy,  # noqa: F401
                                         OperationType, Plan, PlanStep, RiskSurface)


class LegacyPlanStep(BaseModel):
    """Shape emitted by the deprecated capability-template planner."""

    step: int
    capability: str
    action: str


class PlannerResponse(BaseModel):
    steps: list[LegacyPlanStep]
