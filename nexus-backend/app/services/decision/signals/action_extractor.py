"""
Action signal -- weight 0.10, the lightest vote.

Verbs are the weakest predictor because the same verb spans domains: "find"
appears in "find the bug" (CODING) and "find and compare vendors" (RESEARCH).
Deliberately outweighed by the domain signal.
"""

from collections import defaultdict
from typing import Dict, List

from ..models import IntentType
from ..normalize import NormalizedPrompt

ACTION_MAP = {
    "research": IntentType.RESEARCH,
    "investigate": IntentType.RESEARCH,
    "compare": IntentType.RESEARCH,
    "analyze": IntentType.RESEARCH,
    "study": IntentType.RESEARCH,
    "review": IntentType.RESEARCH,

    "code": IntentType.CODING,
    "refactor": IntentType.CODING,
    "debug": IntentType.CODING,
    "implement": IntentType.CODING,
    "deploy": IntentType.AUTOMATION,
    "migrate": IntentType.CODING,

    "summarize": IntentType.FILE,
    "convert": IntentType.FILE,
    "extract": IntentType.FILE,

    "automate": IntentType.AUTOMATION,
    "schedule": IntentType.AUTOMATION,
    "monitor": IntentType.AUTOMATION,
}

_SUFFIXES = ("", "s", "d", "ed", "ing")


class ActionExtractor:

    @staticmethod
    def extract(prompt: NormalizedPrompt) -> List[str]:
        found = []
        for verb in ACTION_MAP:
            stem = verb[:-1] if verb.endswith("e") else verb
            if any(v in prompt.words for v in {verb + s for s in _SUFFIXES} | {stem + "ing", stem + "ed"}):
                found.append(verb)
        return sorted(found)

    @staticmethod
    def score(prompt: NormalizedPrompt) -> Dict[IntentType, float]:
        scores: Dict[IntentType, float] = defaultdict(float)
        for verb in ActionExtractor.extract(prompt):
            scores[ACTION_MAP[verb]] = 1.0
        return dict(scores)
