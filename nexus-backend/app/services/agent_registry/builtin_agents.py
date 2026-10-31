from app.schemas.capability import Capability
from .agent_models import AgentType


BUILTIN_AGENTS = {

    Capability.BROWSER: AgentType.BROWSER,

    Capability.WEB_SEARCH: AgentType.RESEARCH,

    Capability.SUMMARIZATION: AgentType.SUMMARY,

    Capability.CITATION: AgentType.CITATION,

    Capability.REPORT: AgentType.REPORT,

    Capability.CODING: AgentType.CODING,

    Capability.FILE: AgentType.FILE,

    Capability.CHAT: AgentType.CHAT,

    Capability.REASONING: AgentType.REASONING,

    Capability.MEMORY: AgentType.CHAT,
}
