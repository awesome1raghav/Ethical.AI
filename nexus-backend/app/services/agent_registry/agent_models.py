from enum import Enum
from pydantic import BaseModel


class AgentType(str, Enum):

    BROWSER = "BrowserAgent"

    RESEARCH = "ResearchAgent"

    SUMMARY = "SummaryAgent"

    CITATION = "CitationAgent"

    REPORT = "ReportAgent"

    CODING = "CodingAgent"

    FILE = "FileAgent"

    CHAT = "ChatAgent"

    REASONING = "ReasoningAgent"


class AssignedAgent(BaseModel):

    step: int

    capability: str

    agent: AgentType
