"""
Stage 5 -- the routing matrix.

                 LOW conf (<55)   MEDIUM (55-74)     HIGH (>=75)
  TRIVIAL/SIMPLE   CLARIFY        CHAT               CHAT
  MODERATE         CLARIFY        CHAT + confirm     MISSION
  COMPLEX          CLARIFY        MISSION + HITL     MISSION
  MULTI_PHASE      CLARIFY        MISSION + HITL     MISSION + HITL

The rule the table encodes: low confidence never proceeds to an expensive or
irreversible path. The dangerous quadrant is low confidence against high
complexity -- about to spend real compute and take real actions on a guess.
That cell asks a question instead, which is also the handoff into HELIX's
human-in-the-loop path.
"""

from typing import Tuple

from .models import (ComplexityBand, ConfidenceTier, ExecutionMode, IntentType)

_LOW_BANDS = {ComplexityBand.TRIVIAL, ComplexityBand.SIMPLE}
_HITL_BANDS = {ComplexityBand.COMPLEX, ComplexityBand.MULTI_PHASE}

CLARIFY_TEMPLATE = (
    "I could read that a few ways -- it looks like it might be {options}. "
    "Which did you mean?"
)


class DecisionRouter:

    @staticmethod
    def route(
        tier: ConfidenceTier,
        band: ComplexityBand,
        intent_scores: dict,
        destructive: bool = False,
    ) -> Tuple[ExecutionMode, bool, bool, str]:
        """Returns (mode, requires_planning, requires_hitl, clarifying_question)."""

        # Irreversible work overrides the matrix. The MODERATE x MEDIUM cell
        # answers conversationally with a confirm, which is right for ordinary
        # requests and wrong here: routing a destructive request to CHAT means
        # it is never planned, never risk-assessed and never approved. Anything
        # that can destroy data goes down the governed path by construction.
        if destructive:
            return ExecutionMode.MISSION, True, True, ""

        if tier is ConfidenceTier.LOW:
            top = sorted(intent_scores.items(), key=lambda kv: kv[1], reverse=True)[:2]
            options = " or ".join(
                DecisionRouter._describe(i) for i, _ in top
            ) if len(top) == 2 else "something I could not classify"
            return ExecutionMode.CLARIFY, False, False, CLARIFY_TEMPLATE.format(options=options)

        if band in _LOW_BANDS:
            return ExecutionMode.CHAT, False, False, ""

        if tier is ConfidenceTier.MEDIUM:
            if band is ComplexityBand.MODERATE:
                # Confident enough to answer, not confident enough to commit to
                # a multi-step run without a check.
                return ExecutionMode.CHAT, False, True, ""
            return ExecutionMode.MISSION, True, True, ""

        # HIGH confidence
        return ExecutionMode.MISSION, True, band is ComplexityBand.MULTI_PHASE, ""

    @staticmethod
    def _describe(intent: IntentType) -> str:
        return {
            IntentType.CHAT: "a question to answer",
            IntentType.RESEARCH: "a research task",
            IntentType.CODING: "a coding task",
            IntentType.FILE: "a document task",
            IntentType.AUTOMATION: "an automation task",
        }.get(intent, str(intent))
