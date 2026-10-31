"""
Objective signal -- weight 0.15.

Answers "what shape of goal is this": a definition, an investigation, a build,
a transformation. The critical case is definitional framing -- "what is X",
"explain X", "tell me about X" -- which needs no special capability no matter
what X is, and so votes CHAT regardless of subject matter.

This is what stops "what is a research paper?" routing to RESEARCH and
"tell me about the file system" routing to FILE.
"""

from collections import defaultdict
from typing import Dict

from ..models import IntentType
from ..normalize import NormalizedPrompt
from .domain_detector import LANGUAGES

OBJECTIVE_SIGNALS = {
    IntentType.RESEARCH: [
        "find out", "compare", "evaluate", "assess", "why", "investigate",
        "deep dive", "landscape", "top 5", "top 10", "best", "versus", " vs ",
        # The word this whole intent is named after was missing from its own
        # signal list -- "Research about X" and "Research X" scored zero
        # here regardless of subject, and fell through to CHAT.
        "research", "look into", "current state of",
    ],
    IntentType.CODING: [
        "refactor", "implement", "build", "migrate", "debug", "fix", "add",
        "write a", "optimize", "port",
    ],
    IntentType.FILE: [
        "convert", "extract", "generate", "produce", "compile into", "export",
    ],
    IntentType.AUTOMATION: [
        "automate", "schedule", "set up", "orchestrate", "run every", "monitor",
    ],
}


class ObjectiveDetector:

    @staticmethod
    def detect(prompt: NormalizedPrompt) -> Dict[IntentType, float]:
        scores: Dict[IntentType, float] = defaultdict(float)

        for intent, phrases in OBJECTIVE_SIGNALS.items():
            hits = sum(1 for p in phrases if prompt.has(p.strip()))
            if hits:
                scores[intent] = min(1.0, 0.6 + 0.2 * (hits - 1))

        # Definitional framing asks for an answer, not for work. It votes CHAT
        # hard enough to overcome a subject-matter domain hit.
        if prompt.is_definitional:
            scores[IntentType.CHAT] = 1.0

        # "How do I read a PDF in python?" names a document format, but the
        # deliverable is code. Instructional framing plus a language means the
        # format is the subject of the code, not a document to process.
        if prompt.is_instructional and any(prompt.has(l) for l in LANGUAGES):
            scores[IntentType.CODING] = 1.0

        return dict(scores)
