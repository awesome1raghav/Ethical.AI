"""
Stage 2 -- map a task clause to a typed operation.

Verb plus object decides the operation, and the operation carries the risk. So
"delete the production database", "drop the prod db" and "wipe production data"
all land on DATABASE_DELETE and inherit irreversible-destructive without any of
those phrasings appearing in a blocklist.
"""

from typing import List, Optional

from .models import OperationType as OT
from .task_extractor import TaskClause

DB_WORDS = ("database", "db", "table", "schema", "records", "rows", "data")
FILE_WORDS = ("file", "files", "folder", "directory", "readme", "document",
              "documents", "doc", "docs", ".txt", ".md", ".py", ".js", ".ts",
              "spreadsheet", "csv", "pdf", "invoice", "invoices")
DESTRUCTIVE_VERBS = ("delete", "remove", "drop", "purge", "wipe", "truncate")
NET_WORDS = ("internet", "web", "online", "competitor", "competitors", "market",
             "vendors", "landscape", "sources", "latest")

VERB_MAP = {
    "research": OT.NETWORK_REQUEST, "investigate": OT.NETWORK_REQUEST,
    "search": OT.NETWORK_REQUEST, "find": OT.NETWORK_REQUEST,
    "compare": OT.COMPARE, "analyze": OT.ANALYZE, "analyse": OT.ANALYZE,
    "evaluate": OT.ANALYZE, "assess": OT.ANALYZE, "review": OT.ANALYZE,
    "study": OT.ANALYZE, "examine": OT.ANALYZE, "inspect": OT.READ_FILE,
    "identify": OT.ANALYZE, "read": OT.READ_FILE, "extract": OT.READ_FILE,
    "summarize": OT.SUMMARIZE, "summarise": OT.SUMMARIZE,
    "design": OT.DESIGN, "plan": OT.DESIGN,
    "build": OT.IMPLEMENT, "implement": OT.IMPLEMENT, "create": OT.IMPLEMENT,
    "write": OT.IMPLEMENT, "add": OT.IMPLEMENT, "rebuild": OT.IMPLEMENT,
    "refactor": OT.IMPLEMENT, "rewrite": OT.IMPLEMENT, "optimize": OT.IMPLEMENT,
    "restructure": OT.IMPLEMENT, "upgrade": OT.IMPLEMENT, "debug": OT.IMPLEMENT,
    "resolve": OT.IMPLEMENT, "fix": OT.WRITE_FILE, "update": OT.WRITE_FILE,
    "rename": OT.WRITE_FILE, "move": OT.WRITE_FILE, "copy": OT.WRITE_FILE,
    "convert": OT.WRITE_FILE, "transform": OT.WRITE_FILE,
    "migrate": OT.IMPLEMENT, "port": OT.IMPLEMENT,
    "configure": OT.CONFIGURE, "setup": OT.CONFIGURE, "set": OT.CONFIGURE,
    "test": OT.RUN_TESTS, "run": OT.RUN_TESTS,
    "validate": OT.VALIDATE, "verify": OT.VALIDATE,
    "deploy": OT.DEPLOY, "publish": OT.DEPLOY, "release": OT.DEPLOY,
    "generate": OT.GENERATE_ARTIFACT, "produce": OT.GENERATE_ARTIFACT,
    "document": OT.GENERATE_ARTIFACT,
    "backup": OT.DATABASE_READ, "restore": OT.DATABASE_WRITE,
    "send": OT.SEND_MESSAGE, "email": OT.SEND_MESSAGE, "mail": OT.SEND_MESSAGE,
    "notify": OT.SEND_MESSAGE, "message": OT.SEND_MESSAGE, "reply": OT.SEND_MESSAGE,
    "forward": OT.SEND_MESSAGE, "invite": OT.SEND_MESSAGE, "contact": OT.SEND_MESSAGE,
}

COMMS_WORDS = ("email", "e-mail", "mail", "message", "slack", "notify",
               "recipient", "inbox", "@")


def _mentions(clause: TaskClause, words) -> bool:
    blob = clause.text
    return any(w in blob for w in words)


def classify(clause: TaskClause) -> OT:
    verb = clause.verb

    # Destructive verbs resolve by target, because the target decides whether
    # this is a recoverable file removal or an irreversible data loss.
    if verb in DESTRUCTIVE_VERBS:
        if _mentions(clause, DB_WORDS):
            return OT.DATABASE_DELETE
        if _mentions(clause, FILE_WORDS):
            return OT.DELETE_FILE
        return OT.DELETE_FILE

    base = VERB_MAP.get(verb, OT.ANALYZE)

    # Any verb aimed at a person or an address is a message, not a document.
    # "write to shirish", "draft an email", "send the summary" all send something.
    if base in (OT.IMPLEMENT, OT.GENERATE_ARTIFACT) and _mentions(clause, COMMS_WORDS):
        return OT.SEND_MESSAGE

    # Refine by target where the verb alone is ambiguous.
    # A code artifact wins over an incidental "documentation" modifier: building
    # an API *with docs* is still an implementation task, not a writing task.
    CODE_ARTIFACTS = ("api", "service", "dashboard", "schema", "endpoint")
    if base is OT.IMPLEMENT and any(a in clause.artifacts for a in CODE_ARTIFACTS):
        return OT.IMPLEMENT
    if base is OT.IMPLEMENT and _mentions(clause, ("report", "summary", "documentation", "docs", "presentation")):
        return OT.GENERATE_ARTIFACT
    if base in (OT.ANALYZE, OT.COMPARE) and _mentions(clause, NET_WORDS):
        return OT.NETWORK_REQUEST
    if base in (OT.ANALYZE, OT.SUMMARIZE, OT.COMPARE) and _mentions(clause, FILE_WORDS):
        return base  # keep the analytic op; the READ step is added by decomposition
    if base is OT.WRITE_FILE and _mentions(clause, DB_WORDS):
        return OT.DATABASE_WRITE
    if base is OT.GENERATE_ARTIFACT and _mentions(clause, DB_WORDS):
        return OT.DATABASE_WRITE

    return base


def classify_all(clauses: List[TaskClause]) -> List[OT]:
    return [classify(c) for c in clauses]
