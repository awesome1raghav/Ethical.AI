from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class DecisionRequest(BaseModel):
    prompt: str
    mode_override: Optional[str] = None   # "CHAT" | "MISSION" -- user forcing the toggle


class DecisionResponse(BaseModel):
    """
    Serves the Intelligence Panel directly: intent_label, confidence (bar),
    complexity_band (segments), estimated_duration and estimated_cost are the
    five fields that screen renders.
    """
    decision_id: str

    intent: str
    intent_label: str
    intent_scores: Dict[str, float]
    domain: str
    entities: List[str]
    actions: List[str]

    confidence: int
    confidence_tier: str

    complexity_score: int
    complexity_band: str
    complexity_factors: Dict[str, float]
    estimated_steps: int

    execution_mode: str
    mode_source: str
    requires_planning: bool
    requires_hitl: bool
    clarifying_question: Optional[str] = None

    estimated_duration: str
    estimated_cost: str

    classifier_tier: int
    latency_ms: int
    reasoning: List[str]

    # Panel detail: why each signal reads the way it does, keyed by panel row.
    explanations: Dict[str, str] = {}
    estimated_agents: List[str] = []
    agent_breakdown: List[Dict[str, str]] = []
