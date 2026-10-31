"""Stage 0 -- prompt normalization shared by every signal extractor."""

import re
from dataclasses import dataclass, field
from typing import List, Set

URL_RE = re.compile(r"https?://\S+|www\.\S+")
CODE_FENCE_RE = re.compile(r"```.*?```", re.DOTALL)
FILE_REF_RE = re.compile(r"\b[\w\-/]+\.(?:pdf|docx?|xlsx?|csv|pptx?|txt|md|py|js|ts|tsx|json|ya?ml|sql)\b")

# Framing that means "answer me" rather than "go do work".
DEFINITIONAL_RE = re.compile(
    r"\b(what\s+is|what\s+are|what's|whats|what\s+does|explain|tell\s+me\s+about|"
    r"difference\s+between|how\s+does\b|why\s+is|who\s+is|define|meaning\s+of)\b"
)
# "How do I X" asks for an artifact, not a definition -- deliberately excluded above.
INSTRUCTIONAL_RE = re.compile(r"\b(how\s+do\s+i|how\s+can\s+i|how\s+to)\b")


@dataclass
class NormalizedPrompt:
    raw: str
    text: str                                   # lowercased, whitespace collapsed
    words: Set[str] = field(default_factory=set)
    urls: List[str] = field(default_factory=list)
    file_refs: List[str] = field(default_factory=list)
    has_code_fence: bool = False
    is_definitional: bool = False
    is_instructional: bool = False
    word_count: int = 0

    def has(self, phrase: str) -> bool:
        """
        Substring for multi-word phrases; whole-word plus simple inflections for
        single tokens, so "monitors" matches "monitor" and "migrating" matches
        "migrate" without a stemmer dependency.
        """
        if " " in phrase:
            return phrase in self.text
        if phrase in self.words:
            return True
        stem = phrase[:-1] if phrase.endswith("e") else phrase
        return any(v in self.words for v in
                   (phrase + "s", phrase + "es", phrase + "ed", phrase + "ing",
                    stem + "ing", stem + "ed"))


def normalize(prompt: str) -> NormalizedPrompt:
    raw = prompt or ""
    urls = URL_RE.findall(raw)
    file_refs = FILE_REF_RE.findall(raw.lower())
    has_fence = bool(CODE_FENCE_RE.search(raw))

    text = CODE_FENCE_RE.sub(" ", raw).lower()
    text = URL_RE.sub(" ", text)
    text = re.sub(r"\s+", " ", text).strip()

    words = set(re.findall(r"[a-z0-9+#]+", text))

    return NormalizedPrompt(
        raw=raw,
        text=text,
        words=words,
        urls=urls,
        file_refs=file_refs,
        has_code_fence=has_fence,
        is_definitional=bool(DEFINITIONAL_RE.search(text)),
        is_instructional=bool(INSTRUCTIONAL_RE.search(text)),
        word_count=len(text.split()) if text else 0,
    )
