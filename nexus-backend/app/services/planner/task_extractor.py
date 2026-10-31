"""
Stage 1 -- split a prompt into task clauses.

The orphaned WorkflowBuilder split on every '.' and ',', so
"Build an API with auth, tests and docs" became three tasks when it is one task
with three feature modifiers. The rule here is verb presence: a fragment that
carries no action verb is not a task, it is a modifier of the task before it.
That single distinction separates

    "Research competitors, build a dashboard, write docs and deploy it"  -> 4 tasks
    "Build a REST API with auth, tests and documentation"                -> 1 task, 3 modifiers
"""

import re
from dataclasses import dataclass, field
from typing import List

SPLIT_RE = re.compile(r",|\bthen\b|\band then\b|\bafter that\b|\band\b|;|\.")

# Verbs that begin real work. Grouped only for readability.
ACTION_VERBS = {
    # code
    "build", "implement", "create", "write", "add", "refactor", "migrate",
    "port", "fix", "update", "configure", "setup", "set", "generate",
    "rewrite", "restructure", "upgrade", "optimize", "debug", "resolve",
    # data / destructive
    "delete", "remove", "drop", "purge", "wipe", "truncate", "rebuild",
    "restore", "backup",
    # research
    "research", "investigate", "find", "search", "compare", "analyze",
    "analyse", "evaluate", "assess", "review", "study", "summarize",
    "summarise", "read", "inspect", "identify", "examine",
    # delivery
    "deploy", "publish", "release", "run", "test", "validate", "verify",
    "convert", "transform", "rename", "move", "copy", "extract", "produce",
    "document", "design", "plan",
    # communication
    "send", "email", "mail", "notify", "message", "reply", "forward",
    "schedule", "invite", "contact",
}

# Nouns that name a deliverable; used to bias decomposition.
ARTIFACTS = {
    "api": "api", "rest api": "api", "endpoint": "api", "service": "service",
    "dashboard": "dashboard", "report": "report", "documentation": "docs",
    "docs": "docs", "presentation": "deck", "deck": "deck",
    "spreadsheet": "spreadsheet", "test": "tests", "tests": "tests",
    "readme": "readme", "database": "database", "schema": "schema",
    "summary": "report", "comparison": "report",
    "email": "email", "message": "message", "invite": "invite",
    "meeting": "meeting",
}

# Modifier words that expand a template rather than create a task.
FEATURE_WORDS = {
    "authentication", "auth", "tests", "testing", "documentation", "docs",
    "validation", "error handling", "logging", "monitoring", "security",
}

_STOP_PREFIX = re.compile(r"^(please|could you|can you|i want to|i need to|help me)\s+")

# "a to-do list where I can add, complete, and delete tasks" describes one
# artifact's feature set inside a relative clause -- not three independent
# top-level tasks. Splitting on the internal commas/"and" broke "delete
# tasks" into its own clause with no other object of its own, which
# classifier.py's destructive-verb branch then read as a literal
# file-deletion request (there is no DB/file target named -- "tasks" isn't
# one -- so it fell through to the conservative DELETE_FILE default). This
# is common phrasing for describing CRUD features of an app being built
# ("a blog where users can create, edit, and delete posts"), so it is worth
# handling generally, not special-casing one example.
_RELATIVE_CLAUSE_RE = re.compile(r"\bwhere\s+(i|you|we|users?|customers?|people)\s+can\b")


def _suppress_split_in_relative_clauses(text: str) -> str:
    m = _RELATIVE_CLAUSE_RE.search(text)
    if not m:
        return text
    end = len(text)
    for boundary in (".", ";"):
        idx = text.find(boundary, m.end())
        if idx != -1:
            end = min(end, idx)
    head, span, tail = text[:m.end()], text[m.end():end], text[end:]
    # Neutralize list separators only inside the relative-clause span, so the
    # whole span survives SPLIT_RE as one fragment attached to the verb that
    # precedes "where" (e.g. "build"), instead of each coordinated verb
    # inside it spawning its own top-level clause.
    span = re.sub(r",|\band\b", " ", span)
    return head + span + tail

# Words that are both verb and noun. In a bare fragment ("tests", "documentation")
# they name a deliverable, not an action -- only treat them as a verb when the
# fragment carries enough else to look like a clause.
AMBIGUOUS_VERB_NOUNS = {
    "test", "document", "design", "plan", "report", "backup", "review",
    "search", "summary", "run",
}


@dataclass
class TaskClause:
    text: str
    verb: str = ""
    objects: List[str] = field(default_factory=list)
    artifacts: List[str] = field(default_factory=list)
    features: List[str] = field(default_factory=list)
    scope_broad: bool = False           # "entire", "all", "every"


BROAD_SCOPE = ("entire", " all ", "every", "whole", "across", "multiple", "each")


def _first_verb(words: List[str]) -> str:
    for w in words:
        base = w.rstrip("s") if w.endswith("s") and w[:-1] in ACTION_VERBS else w
        if base in ACTION_VERBS:
            return base
        if w in ACTION_VERBS:
            return w
    return ""


def extract(prompt: str) -> List[TaskClause]:
    text = _STOP_PREFIX.sub("", (prompt or "").strip().lower())
    if not text:
        return []
    text = _suppress_split_in_relative_clauses(text)

    raw = [f.strip() for f in SPLIT_RE.split(text) if f.strip()]
    clauses: List[TaskClause] = []

    for fragment in raw:
        words = re.findall(r"[a-z0-9+#.]+", fragment)
        verb = _first_verb(words)

        # A one- or two-word fragment whose only verb is a verb/noun ambiguity
        # is a deliverable being listed, not a task being requested.
        if verb in AMBIGUOUS_VERB_NOUNS and len(words) <= 2:
            verb = ""

        artifacts = [v for k, v in ARTIFACTS.items() if k in fragment]
        features = [f for f in FEATURE_WORDS if f in fragment]

        if not verb:
            # No action verb: fold into the preceding task as a modifier.
            if clauses:
                clauses[-1].features.extend(features or words[:2])
                clauses[-1].artifacts.extend(artifacts)
                clauses[-1].text += f", {fragment}"
            continue

        clauses.append(TaskClause(
            text=fragment,
            verb=verb,
            objects=[w for w in words if w != verb][:6],
            artifacts=artifacts,
            features=features,
            scope_broad=any(b in f" {fragment} " for b in BROAD_SCOPE),
        ))

    # Deduplicate modifier lists while preserving order.
    for c in clauses:
        c.features = list(dict.fromkeys(c.features))
        c.artifacts = list(dict.fromkeys(c.artifacts))

    return clauses
