"""Types produced by the Decision Engine."""

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional


class IntentType(str, Enum):
    """Routing taxonomy. Drives capability and model selection."""
    CHAT = "CHAT"
    RESEARCH = "RESEARCH"
    CODING = "CODING"
    FILE = "FILE"
    AUTOMATION = "AUTOMATION"
    COMMUNICATION = "COMMUNICATION"


class ComplexityBand(str, Enum):
    """How much work. Independent of IntentType."""
    TRIVIAL = "TRIVIAL"
    SIMPLE = "SIMPLE"
    MODERATE = "MODERATE"
    COMPLEX = "COMPLEX"
    MULTI_PHASE = "MULTI_PHASE"


class ConfidenceTier(str, Enum):
    HIGH = "HIGH"        # >= 75, proceed
    MEDIUM = "MEDIUM"    # 55-74, proceed with guard rails
    LOW = "LOW"          # < 55, do not act


class ExecutionMode(str, Enum):
    CHAT = "CHAT"
    MISSION = "MISSION"
    CLARIFY = "CLARIFY"


class ModeSource(str, Enum):
    AUTO = "AUTO"
    USER_OVERRIDE = "USER_OVERRIDE"


# Band boundaries, single source of truth.
COMPLEXITY_BANDS = (
    (20, ComplexityBand.TRIVIAL),
    (40, ComplexityBand.SIMPLE),
    (60, ComplexityBand.MODERATE),
    (80, ComplexityBand.COMPLEX),
    (101, ComplexityBand.MULTI_PHASE),
)

CONFIDENCE_HIGH = 75
CONFIDENCE_MEDIUM = 55


def band_for(score: int) -> ComplexityBand:
    for ceiling, band in COMPLEXITY_BANDS:
        if score < ceiling:
            return band
    return ComplexityBand.MULTI_PHASE


def tier_for(confidence: int) -> ConfidenceTier:
    if confidence >= CONFIDENCE_HIGH:
        return ConfidenceTier.HIGH
    if confidence >= CONFIDENCE_MEDIUM:
        return ConfidenceTier.MEDIUM
    return ConfidenceTier.LOW


@dataclass
class DecisionRecord:
    """
    The single contract every downstream subsystem reads: the planner, HELIX,
    MATRIX, the audit store, the dashboard and the Intelligence Panel.
    """
    prompt: str

    # intent
    intent: IntentType = IntentType.CHAT
    intent_label: str = "General Operations"
    intent_scores: Dict[str, float] = field(default_factory=dict)
    domain: str = "General"
    entities: List[str] = field(default_factory=list)
    actions: List[str] = field(default_factory=list)

    # confidence
    confidence: int = 0
    confidence_tier: ConfidenceTier = ConfidenceTier.LOW

    # complexity
    complexity_score: int = 0
    complexity_band: ComplexityBand = ComplexityBand.TRIVIAL
    complexity_factors: Dict[str, float] = field(default_factory=dict)
    estimated_steps: int = 1

    # routing
    execution_mode: ExecutionMode = ExecutionMode.CHAT
    mode_source: ModeSource = ModeSource.AUTO
    requires_planning: bool = False
    requires_hitl: bool = False
    clarifying_question: Optional[str] = None

    # provenance
    classifier_tier: int = 1
    latency_ms: int = 0
    reasoning: List[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "prompt": self.prompt,
            "intent": self.intent.value,
            "intent_label": self.intent_label,
            "intent_scores": self.intent_scores,
            "domain": self.domain,
            "entities": self.entities,
            "actions": self.actions,
            "confidence": self.confidence,
            "confidence_tier": self.confidence_tier.value,
            "complexity_score": self.complexity_score,
            "complexity_band": self.complexity_band.value,
            "complexity_factors": self.complexity_factors,
            "estimated_steps": self.estimated_steps,
            "execution_mode": self.execution_mode.value,
            "mode_source": self.mode_source.value,
            "requires_planning": self.requires_planning,
            "requires_hitl": self.requires_hitl,
            "clarifying_question": self.clarifying_question,
            "classifier_tier": self.classifier_tier,
            "latency_ms": self.latency_ms,
            "reasoning": self.reasoning,
        }
