"""
Entity signal -- weight 0.25.

Answers "what object is being acted on". Entities are more specific than domain
words: "presentation" and "spreadsheet" are artifacts that imply a produced
file, whereas "python" is merely a subject.
"""

from collections import defaultdict
from typing import Dict, List, Tuple

from ..models import IntentType
from ..normalize import NormalizedPrompt

# entity -> (intent, strength)
ENTITY_MAP: dict = {
    # FILE artifacts
    "presentation": (IntentType.FILE, 0.9),
    "slide deck": (IntentType.FILE, 0.9),
    "spreadsheet": (IntentType.FILE, 0.9),
    "invoice": (IntentType.FILE, 0.8),
    "invoices": (IntentType.FILE, 0.8),
    "pdf": (IntentType.FILE, 0.8),
    "documents": (IntentType.FILE, 0.85),
    "document": (IntentType.FILE, 0.7),
    "report": (IntentType.FILE, 0.6),
    "tables": (IntentType.FILE, 0.6),
    "folder": (IntentType.FILE, 0.7),

    # CODING artifacts
    "codebase": (IntentType.CODING, 0.9),
    "repository": (IntentType.CODING, 0.85),
    "dashboard": (IntentType.CODING, 0.7),
    "rest api": (IntentType.CODING, 0.9),
    "api": (IntentType.CODING, 0.6),
    "endpoint": (IntentType.CODING, 0.8),
    "unit tests": (IntentType.CODING, 0.85),
    "module": (IntentType.CODING, 0.6),
    "readme": (IntentType.CODING, 0.8),
    "functions": (IntentType.CODING, 0.7),
    "bug": (IntentType.CODING, 0.8),

    # RESEARCH artifacts
    "landscape": (IntentType.RESEARCH, 0.8),
    "vendors": (IntentType.RESEARCH, 0.7),
    "competitor": (IntentType.RESEARCH, 0.8),
    "findings": (IntentType.RESEARCH, 0.7),
    "sources": (IntentType.RESEARCH, 0.7),
    "databases": (IntentType.RESEARCH, 0.6),
    "tools": (IntentType.RESEARCH, 0.6),
    "libraries": (IntentType.RESEARCH, 0.6),
    "frameworks": (IntentType.RESEARCH, 0.6),
    "alternatives": (IntentType.RESEARCH, 0.7),

    # AUTOMATION artifacts
    "workflow": (IntentType.AUTOMATION, 0.85),
    "pipeline": (IntentType.AUTOMATION, 0.8),
    "cron": (IntentType.AUTOMATION, 0.9),
    "backup": (IntentType.AUTOMATION, 0.7),
    "error logs": (IntentType.AUTOMATION, 0.8),
    "staging": (IntentType.AUTOMATION, 0.7),
}


class EntityExtractor:

    @staticmethod
    def extract(prompt: NormalizedPrompt) -> List[str]:
        return sorted({e for e in ENTITY_MAP if prompt.has(e)})

    @staticmethod
    def score(prompt: NormalizedPrompt) -> Dict[IntentType, float]:
        scores: Dict[IntentType, float] = defaultdict(float)
        for entity, (intent, strength) in ENTITY_MAP.items():
            if prompt.has(entity):
                scores[intent] = max(scores[intent], strength)
        return dict(scores)
