from .analysis_agent import AnalysisAgent
from .browser_agent import BrowserAgent
from .chat_agent import ChatAgent
from .coding_agent import CodingAgent
from .file_agent import FileAgent
from .memory_agent import MemoryAgent
from .reasoning_agent import ReasoningAgent
from .report_agent import ReportAgent
from .research_agent import ResearchAgent


AGENT_REGISTRY = {

    "BrowserAgent": BrowserAgent,

    "ResearchAgent": ResearchAgent,

    "AnalysisAgent": AnalysisAgent,

    "SummaryAgent": AnalysisAgent,

    "CodingAgent": CodingAgent,

    "ReportAgent": ReportAgent,

    "MemoryAgent": MemoryAgent,

    "ReasoningAgent": ReasoningAgent,

    "FileAgent": FileAgent,

    "ChatAgent": ChatAgent,
}
