"""
Stage 2 -- weighted vote across the four signals.

    score[intent] = domain*0.50 + entity*0.25 + objective*0.15 + action*0.10

The weights are carried over from the orphaned nexus/intent_engine, which had
the right idea: subject matter dominates, verbs barely count. Independent
extractors are what fix first-match-wins -- in "find the bug in my python code",
`python` votes CODING at 0.50 while `find` votes RESEARCH at 0.10.

The full distribution is returned, not just the winner: Stage 3 needs the
runner-up to compute a margin.
"""

from collections import defaultdict
from typing import Dict, Tuple

from .models import IntentType
from .normalize import NormalizedPrompt
from .signals import ActionExtractor, DomainDetector, EntityExtractor, ObjectiveDetector

WEIGHTS = {"domain": 0.50, "entity": 0.25, "objective": 0.15, "action": 0.10}

# CHAT is the fallback and therefore always a live candidate. Without a floor,
# a prompt matching no keyword ("thanks, that helped") would produce an all-zero
# distribution and an undefined margin.
CHAT_FLOOR = 0.35
DEFINITIONAL_CHAT_FLOOR = 0.75


class IntentVoter:

    @staticmethod
    def vote(prompt: NormalizedPrompt) -> Tuple[Dict[IntentType, float], float]:
        contributions = {
            "domain": DomainDetector.detect(prompt),
            "entity": EntityExtractor.score(prompt),
            "objective": ObjectiveDetector.detect(prompt),
            "action": ActionExtractor.score(prompt),
        }

        scores: Dict[IntentType, float] = defaultdict(float)
        for signal, weight in WEIGHTS.items():
            for intent, value in contributions[signal].items():
                scores[intent] += value * weight

        # A definitional question is a chat request by construction, whatever
        # its subject. Without this, "explain what a dashboard is" is pulled to
        # CODING by the word "dashboard".
        # Evidence is the signal mass that actually fired, measured before the
        # floor is applied. A prompt matching no keyword has zero evidence, and
        # must not be reported as confident just because CHAT wins by default.
        evidence = sum(scores.values())

        floor = DEFINITIONAL_CHAT_FLOOR if prompt.is_definitional else CHAT_FLOOR
        # Distinguish winning on merit from winning by default. The definitional
        # floor is derived from a detected signal, so it counts as evidence; the
        # plain CHAT floor is a fallback and does not.
        chat_by_default = (
            not prompt.is_definitional
            and scores[IntentType.CHAT] < CHAT_FLOOR
            and max(scores.values(), default=0.0) <= CHAT_FLOOR
        )
        scores[IntentType.CHAT] = max(scores[IntentType.CHAT], floor)
        if chat_by_default:
            evidence = 0.0
        return dict(scores), evidence
