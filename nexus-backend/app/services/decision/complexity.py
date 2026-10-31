"""
Stage 4 -- complexity scoring, independent of intent.

Answers "how much work", which is what decides CHAT vs MISSION. Intent cannot
answer it: "Explain Python" and "Refactor the authentication service" are both
about code, and only one of them needs a plan.

Five factors, mapped onto the four parameters named in Ch. 4.5:

    step_estimate    0.30   Request Complexity
    resource_need    0.25   Resource Requirement
    output_artifact  0.20   Output Type
    context_volume   0.15   (not named in the spec)
    duration_class   0.10   Execution Time
"""

from typing import Dict, Tuple

from .models import ComplexityBand, band_for
from .normalize import NormalizedPrompt
from .signals.domain_detector import LANGUAGES

WEIGHTS = {
    "step_estimate": 0.30,
    "resource_need": 0.25,
    "output_artifact": 0.20,
    "context_volume": 0.15,
    "duration_class": 0.10,
}

# Work spanning many targets rather than one.
BREADTH_WORDS = ["across", "all ", "every", "entire", "multiple", "codebase",
                 "folder", "project-wide", "each ", "several"]
# Verbs whose ordinary meaning is a sequence of edits, not one edit.
SCOPE_VERBS = ["refactor", "migrate", "build", "audit", "research", "investigate",
               "implement", "automate", "redesign", "rewrite"]
SEQUENCE_MARKERS = [" and ", " then ", " after ", ",", " plus ", " followed by "]

# Resource classes. Anything here means the request cannot be answered from the
# model's own weights.
WEB_WORDS = ["research", "search", "investigate", "landscape", "competitor",
             "vendors", "trends", "sources", "deep dive", "latest", "top 5", "top 10"]
FILE_WORDS = ["pdf", "docx", "document", "documents", "invoice", "invoices",
              "spreadsheet", "excel", "csv", "folder", "attachment", "tables",
              "file", "files", "log", "logs", "directory"]
EXEC_WORDS = ["deploy", "schedule", "cron", "automate", "workflow", "pipeline",
              "monitor", "backup", "staging", "job", "agent"]
# A datastore is not something the model can answer from its own weights: the
# request implies connecting to, querying or mutating a system outside itself.
DATA_WORDS = ["database", "postgresql", "postgres", "mysql", "sqlite", "mongodb",
              "redis", "sql", "table", "schema", "query", "records", "rows",
              "credentials", "connection string", "production"]
# Irreversible verbs. Scored here so complexity reflects consequence, not just size.
DESTRUCTIVE_WORDS = ["delete", "drop", "purge", "wipe", "truncate", "remove",
                     "destroy", "erase"]
# Contacting someone is externally visible and cannot be undone. It is not
# destructive, but it earns the same "must be planned and approved" treatment.
IRREVERSIBLE_OUTBOUND = ["send", "email", "e-mail", "notify",
                         "reply", "forward", "invite", "publish", "post"]
OUTBOUND_TARGETS = ["email", "mail", "message", "slack", "recipient", "@",
                    "invite", "meeting", "contact"]
CODE_SCAN_WORDS = ["codebase", "repository", "repo", "module", "test suite", "project"]
# Changing existing code is not the same as writing a snippet: you must read the
# current implementation before you can alter it. Acquire, then act.
MODIFY_VERBS = ["refactor", "migrate", "port", "rewrite", "restructure", "upgrade"]
# ...but only in a code context. "Rewrite this sentence to be more concise" is
# prose the user already supplied, not a codebase that has to be read first.
CODE_CONTEXT = ["code", "codebase", "api", "endpoint", "function", "functions",
                "class", "service", "auth", "module", "repository", "repo",
                "project", "schema", "component"]

# Produced deliverables, by how much assembly they imply.
ARTIFACTS = {
    "presentation": 0.95, "slide deck": 0.95, "deck": 0.9, "slides": 0.9,
    "dashboard": 0.90, "rest api": 0.90, "spreadsheet": 0.85, "report": 0.85,
    "documentation": 0.8, "docs": 0.7, "summary": 0.40, "findings": 0.6,
    "tables": 0.5, "chart": 0.6,
    # "Build a simple web app" scored 0 here (no entry at all) and 0 on
    # resource_need (MODIFY_VERBS/CODE_SCAN_WORDS only recognize touching an
    # *existing* codebase, not constructing a new one) -- two of five factors
    # zeroed out for what is obviously a multi-file build, landing the whole
    # request at SIMPLE and routing it to CHAT, where no code is ever written
    # to disk. A web app implies at minimum markup, styling and behaviour
    # assembled together -- at least as much real assembly as a dashboard.
    "web app": 0.90, "webapp": 0.90, "website": 0.85, "app": 0.75,
    "landing page": 0.85,
}
STRONG_ARTIFACT = 0.80
ARTIFACT_FLOOR_SCORE = 42          # a deliverable is at least a MODERATE mission

# Needing a browser, a file parse, a codebase traversal or a scheduler means the
# model cannot answer from its own weights: it must acquire the resource and
# then act on it. That is two steps minimum, so it is never a single-turn chat.
STRONG_RESOURCE = 0.80
RESOURCE_FLOOR_SCORE = 42

# Definitional framing cannot require a mission -- unless it also asks for a
# deliverable ("explain X and produce a report").
PRODUCTION_VERBS = ["produce", "generate", "create", "build", "write", "draft", "compile"]
DEFINITIONAL_CAP = 39              # top of SIMPLE

LONG_RUNNING = ["research", "investigate", "build", "migrate", "refactor",
                "audit", "automate", "deploy", "monitor", "schedule", "analyze",
                "deep dive", "compare", "extract", "set up", "scan", "convert",
                "evaluate", "assess", "review"]
IMMEDIATE = ["explain", "what is", "define", "fix this", "typo", "rewrite this",
             "summarize this", "thanks"]


def _in_code_context(prompt: NormalizedPrompt) -> bool:
    return any(prompt.has(w) for w in CODE_CONTEXT + LANGUAGES)


def _hit_score(prompt: NormalizedPrompt, words, base=0.5, step=0.2, cap=1.0) -> float:
    hits = sum(1 for w in words if prompt.has(w.strip()))
    return 0.0 if not hits else min(cap, base + step * (hits - 1))


class ComplexityScorer:

    @staticmethod
    def score(prompt: NormalizedPrompt) -> Tuple[int, ComplexityBand, Dict[str, float], int]:
        f: Dict[str, float] = {}

        # 1 -- how many steps this decomposes into
        sequence = sum(1 for m in SEQUENCE_MARKERS if m in prompt.text)
        breadth = sum(1 for w in BREADTH_WORDS if w in prompt.text)
        scope = sum(1 for v in SCOPE_VERBS if prompt.has(v))
        f["step_estimate"] = min(1.0, 0.2 * sequence + 0.3 * breadth + 0.35 * scope)

        # 2 -- resources beyond the model itself
        resource = max(
            _hit_score(prompt, WEB_WORDS, base=0.9, step=0.05),
            _hit_score(prompt, EXEC_WORDS, base=0.9, step=0.05),
            _hit_score(prompt, FILE_WORDS, base=0.8, step=0.1),
            _hit_score(prompt, CODE_SCAN_WORDS, base=0.8, step=0.1),
            _hit_score(prompt, DATA_WORDS, base=0.85, step=0.05),
            _hit_score(prompt, MODIFY_VERBS, base=0.85, step=0.05) if _in_code_context(prompt) else 0.0,
        )
        if prompt.urls or prompt.file_refs:
            resource = max(resource, 0.8)
        f["resource_need"] = resource

        # 3 -- what gets produced
        artifact = 0.0
        for name, strength in ARTIFACTS.items():
            if prompt.has(name):
                artifact = max(artifact, strength)
        if any(prompt.has(w) for w in FILE_WORDS):
            artifact = max(artifact, 0.6)
        f["output_artifact"] = artifact

        # 4 -- how much material is in play
        volume = min(1.0, prompt.word_count / 40.0)
        if breadth:
            volume = max(volume, 0.6)
        if any(t.isdigit() and int(t) > 5 for t in prompt.words if t.isdigit()):
            volume = max(volume, 0.7)
        f["context_volume"] = round(volume, 3)

        # 5 -- immediate or long-running
        duration = _hit_score(prompt, LONG_RUNNING, base=0.7, step=0.1)
        # An irreversible action is never a throwaway request, whatever its length.
        if any(prompt.has(w) for w in DESTRUCTIVE_WORDS) and any(prompt.has(w) for w in DATA_WORDS + FILE_WORDS):
            duration = max(duration, 0.8)
            f["_destructive"] = 1.0

        # Outbound communication: irreversible and reaches a third party, so it
        # must be planned and approved rather than answered conversationally.
        if (any(prompt.has(w) for w in IRREVERSIBLE_OUTBOUND)
                and any(prompt.has(w) for w in OUTBOUND_TARGETS)
                and not (prompt.is_definitional or prompt.is_instructional)):
            resource = max(resource, 0.9)
            f["resource_need"] = resource
            f["_destructive"] = 1.0
        if any(prompt.has(w) for w in IMMEDIATE):
            duration = min(duration, 0.2)
        f["duration_class"] = duration

        raw = sum(f[k] * w for k, w in WEIGHTS.items())
        score = int(round(raw * 100))

        # A named deliverable is inherently multi-step: gather, structure, render.
        if artifact >= STRONG_ARTIFACT:
            score = max(score, ARTIFACT_FLOOR_SCORE)

        # Same logic for external resources -- but only when the request is to
        # *do* the thing. "How do I read a PDF in python?" names a format
        # without there being a document to process; it wants a code snippet.
        asks_how = prompt.is_instructional or prompt.is_definitional
        if resource >= STRONG_RESOURCE and not asks_how:
            score = max(score, RESOURCE_FLOOR_SCORE)

        # Applied last so it overrides the artifact floor: "explain what a
        # dashboard is" names a dashboard but asks only for an explanation.
        asks_for_output = any(prompt.has(v) for v in PRODUCTION_VERBS)
        if prompt.is_definitional and not asks_for_output:
            score = min(score, DEFINITIONAL_CAP)

        score = max(0, min(100, score))
        steps = max(1, int(round(1 + f["step_estimate"] * 6)))
        return score, band_for(score), {k: round(v, 3) for k, v in f.items()}, steps
