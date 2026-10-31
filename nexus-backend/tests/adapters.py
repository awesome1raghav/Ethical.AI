"""
Engine adapters for the Decision Engine eval harness.

The harness measures a uniform `Decision` shape so that the current keyword
classifier and the forthcoming DecisionService can be scored against the same
fixture. To evaluate a new engine, add an adapter here and register it in
ADAPTERS -- the harness itself does not change.
"""

from dataclasses import dataclass
from typing import Callable, Dict, Optional


@dataclass
class Decision:
    intent: str
    mode: str                          # CHAT | MISSION | CLARIFY
    confidence: Optional[int] = None   # 0-100, None if the engine has no notion
    complexity: Optional[str] = None   # band, None if unimplemented


def current_engine(prompt: str) -> Decision:
    """
    Today's pipeline: IntentService.detect -> ExecutionModeRouter.select.

    Confidence is reported as 100 because app/api/intent.py returns a literal
    1.0 for every prompt. Complexity is None because no scorer exists.
    """
    from app.services.intent.intent_service import IntentService
    from app.services.runtime.execution_mode_router import ExecutionModeRouter

    intent = IntentService.detect(prompt)
    mode = ExecutionModeRouter.select(intent.value)

    # ExecutionModeRouter speaks CHAT/AGENT; the spec and the target engine
    # speak CHAT/MISSION. AGENT and MISSION are the same path.
    mode_name = "MISSION" if mode.value == "AGENT" else mode.value

    return Decision(
        intent=intent.value,
        mode=mode_name,
        confidence=100,
        complexity=None,
    )


def decision_engine(prompt: str) -> Decision:
    """Target engine (app/services/decision/). Not built yet."""
    from app.services.decision.decision_service import DecisionService  # noqa

    record = DecisionService.decide(prompt)
    return Decision(
        intent=record.intent.value,
        mode=record.execution_mode.value,
        confidence=record.confidence,
        complexity=record.complexity_band.value,
    )


ADAPTERS: Dict[str, Callable[[str], Decision]] = {
    "current": current_engine,
    "decision": decision_engine,
}
