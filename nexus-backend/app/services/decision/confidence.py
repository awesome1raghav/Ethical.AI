"""
Stage 3 -- margin-based confidence.

Confidence is the gap between the winner and the runner-up, never the winner's
absolute score. Two intents at 0.80 and 0.79 is a coin flip and must not read as
confident, which is precisely the failure mode of the hardcoded 1.0 this
replaces.

Formula carried over from nexus/intent_engine:

    confidence = clamp(55, 95, (margin / winner) * 100 + 70)
"""

from typing import Dict, Tuple

from .models import ConfidenceTier, IntentType, tier_for

FLOOR, CEILING = 55, 95

# Below this much signal mass, the classifier has effectively seen nothing.
NO_EVIDENCE_THRESHOLD = 0.05
UNMATCHED_CEILING = 65          # MEDIUM: proceed with guard rails, never HIGH


class ConfidenceScorer:

    @staticmethod
    def score(scores: Dict[IntentType, float], evidence: float = 1.0) -> Tuple[int, ConfidenceTier]:
        if not scores:
            return 0, ConfidenceTier.LOW

        ranked = sorted(scores.values(), reverse=True)
        winner = ranked[0]

        if winner <= 0:
            return 0, ConfidenceTier.LOW

        runner_up = ranked[1] if len(ranked) > 1 else 0.0
        margin = winner - runner_up

        raw = int((margin / winner) * 100) + 70
        confidence = max(FLOOR, min(CEILING, raw))

        # A clean margin over an empty field is not evidence of anything. Without
        # this, "write a regex that matches email addresses" -- which matches no
        # keyword at all -- reports 95 for CHAT purely because CHAT holds the
        # floor and nothing contests it. Cap such prompts below the HIGH tier so
        # they escalate to the tier-2 classifier instead of acting on a guess.
        if evidence < NO_EVIDENCE_THRESHOLD:
            confidence = min(confidence, UNMATCHED_CEILING)

        return confidence, tier_for(confidence)
