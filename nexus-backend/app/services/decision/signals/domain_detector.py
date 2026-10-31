"""
Domain signal -- weight 0.50, the heaviest vote.

Answers "what subject is this about", which is the strongest predictor of which
capabilities and model the request needs. Carries the most weight so that a
subject-matter word beats an incidental verb: "find the bug in my python code"
must land on CODING, not RESEARCH, even though it opens with "find".
"""

from collections import defaultdict
from typing import Dict

from ..models import IntentType
from ..normalize import NormalizedPrompt

LANGUAGES = ["python", "javascript", "typescript", "java", "rust", "golang",
             "c++", "c#", "ruby", "php", "kotlin", "swift", "scala"]

DOMAIN_MAP = {
    IntentType.RESEARCH: [
        "research", "investigate", "investigation", "literature", "survey",
        "competitor", "competitive", "landscape", "market", "trends", "vendors",
        "sources", "citation", "citations", "paper", "papers", "study",
        "deep dive", "state of the art", "benchmark", "findings",
        "top 5", "top 10", "alternatives", "best",
    ],
    IntentType.CODING: [
        "code", "codebase", "python", "javascript", "typescript", "java", "rust",
        "golang", "react", "fastapi", "django", "flask", "node", "sql",
        "api", "endpoint", "backend", "frontend", "function", "functions",
        "class", "method", "bug", "bugs", "refactor", "repository", "repo",
        "unit test", "unit tests", "test suite", "compile", "runtime error",
        "dashboard", "rest api", "module", "readme", "typo", "hello world",
        "migrate", "migration", "jwt", "auth", "authentication service",
        # Databases and infrastructure. Their absence meant "write Python that
        # connects to PostgreSQL" scored no domain signal at all, and
        # "delete the production database" fell through to CHAT.
        "postgresql", "postgres", "mysql", "sqlite", "mongodb", "redis",
        "database", "sql", "query", "table", "schema", "index", "orm",
        "server", "docker", "kubernetes", "container", "credentials",
        "production", "staging environment", "connection string",
        # "Build me a web app" / "build a to-do list app" named no language,
        # framework or infra term above and so scored zero domain signal at
        # all -- the request that should most obviously read as CODING (the
        # word "app" is right there) fell through to CHAT with no code ever
        # produced. Same disease as the missing "research" keyword: the
        # dominant, heaviest-weighted signal has no entry for the plainest
        # phrasing of its own intent.
        "app", "web app", "webapp", "website", "web page", "webpage",
        "landing page", "to-do list", "todo list", "single page app", "spa",
    ],
    IntentType.FILE: [
        "pdf", "excel", "spreadsheet", "csv", "docx", "document", "documents",
        "invoice", "invoices", "presentation", "slide", "slides", "deck",
        "report", "attachment", "folder", "worksheet", "table", "tables",
    ],
    IntentType.COMMUNICATION: [
        "email", "e-mail", "mail", "message", "slack", "notify", "notification",
        "recipient", "inbox", "reply", "forward", "invite", "invitation",
        "meeting", "calendar", "send to", "contact",
    ],
    IntentType.AUTOMATION: [
        "workflow", "pipeline", "automate", "automation", "schedule", "scheduled",
        "cron", "agent", "orchestrate", "trigger", "job", "monitor", "monitors",
        "monitoring", "deployment", "staging", "ci", "cd", "backup",
        "smoke test", "environment",
    ],
}

# Business domain, reported separately for governance and the Intelligence Panel.
# This is the taxonomy the orphaned intent_engine used; it answers a different
# question than IntentType and is kept as a secondary output rather than merged.
BUSINESS_DOMAIN_MAP = {
    "Human Resources": ["employee", "employees", "promotion", "candidate", "recruitment", "payroll", "benefits", "performance review"],
    "Finance": ["invoice", "invoices", "payment", "revenue", "forecast", "budget", "investment", "refund", "transaction", "fraud"],
    "Healthcare": ["patient", "medical", "diagnosis", "hospital", "treatment", "clinical"],
    "Cybersecurity": ["threat", "incident", "vulnerability", "attack", "security", "breach", "firewall", "audit log"],
    "Government Services": ["citizen", "policy", "regulation", "permit", "public service", "government"],
    "Operations": ["crm", "inventory", "logistics", "sales process", "operations", "deployment", "backup"],
    "Research & Analysis": ["research", "analyze", "evaluate", "investigate", "study", "market", "competitor", "trends"],
    "Engineering": ["code", "codebase", "api", "backend", "frontend", "refactor", "deploy", "repository"],
    "Communication": ["notify", "email", "report", "summary", "presentation", "send"],
}


class DomainDetector:

    @staticmethod
    def detect(prompt: NormalizedPrompt) -> Dict[IntentType, float]:
        scores: Dict[IntentType, float] = defaultdict(float)

        for intent, keywords in DOMAIN_MAP.items():
            hits = sum(1 for kw in keywords if prompt.has(kw))
            if hits:
                # Saturating: a second keyword confirms, a fifth adds little.
                scores[intent] = min(1.0, 0.55 + 0.15 * (hits - 1))

        # A named programming language is a stronger subject signal than a
        # generic technical noun: it says the answer must be code.
        if any(prompt.has(l) for l in LANGUAGES):
            scores[IntentType.CODING] = max(scores[IntentType.CODING], 0.75)

        # A code fence or a source-file reference is near-conclusive.
        if prompt.has_code_fence or any(
            r.endswith((".py", ".js", ".ts", ".tsx", ".sql", ".json")) for r in prompt.file_refs
        ):
            scores[IntentType.CODING] = max(scores[IntentType.CODING], 0.9)

        # A document reference is equally conclusive for FILE.
        if any(r.endswith((".pdf", ".docx", ".doc", ".xlsx", ".xls", ".csv", ".pptx")) for r in prompt.file_refs):
            scores[IntentType.FILE] = max(scores[IntentType.FILE], 0.9)

        return dict(scores)

    @staticmethod
    def business_domain(prompt: NormalizedPrompt) -> str:
        best, best_hits = "General", 0
        for domain, keywords in BUSINESS_DOMAIN_MAP.items():
            hits = sum(1 for kw in keywords if prompt.has(kw))
            if hits > best_hits:
                best, best_hits = domain, hits
        return best
