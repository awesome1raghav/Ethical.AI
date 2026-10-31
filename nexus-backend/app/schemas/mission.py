from typing import List, Optional

from pydantic import BaseModel


class MissionRequest(BaseModel):
    prompt: str
    # Reuse a decision from POST /api/decision instead of re-deriving one.
    decision_id: Optional[str] = None


class MissionPlanStep(BaseModel):
    """A real planned step, with its actual execution status and output."""
    step_id: str
    action: str
    description: str
    purpose: str
    operation: str
    agent: str
    depends_on: List[str] = []
    destructive: bool = False
    reversible: bool = True
    requires_human_approval: bool = False
    validation: Optional[str] = None

    # Real execution state -- never fabricated. "pending" until AgentExecutor
    # actually reaches this step.
    status: str = "pending"          # pending | running | completed | failed | awaiting_approval
    output: Optional[str] = None
    error: Optional[str] = None


class MissionResponse(BaseModel):
    mission_id: str
    trace_id: str
    status: str
    decision_id: Optional[str] = None
    intent: Optional[str] = None
    confidence: Optional[int] = None
    complexity_band: Optional[str] = None
    execution_mode: Optional[str] = None
    clarifying_question: Optional[str] = None
    status_reason: Optional[str] = None

    plan_id: Optional[str] = None
    execution_strategy: Optional[str] = None
    steps: List[MissionPlanStep] = []
    requires_human_approval: bool = False
    pending_step_id: Optional[str] = None
    running_step_id: Optional[str] = None
    cancel_requested: bool = False
    risk_level: Optional[str] = None
    risk_reason: Optional[str] = None
    # True only when CodingAgent actually wrote real files to this mission's
    # workspace/apps/{mission_id}/ directory -- never inferred from intent or
    # step status, since a CODING mission can still fail before writing
    # anything.
    has_app_files: bool = False


class ApproveRequest(BaseModel):
    step_id: Optional[str] = None   # optional cross-check against pending_step_id
