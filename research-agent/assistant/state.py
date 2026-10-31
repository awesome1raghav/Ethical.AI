"""State passed between nodes of the research graph."""

import operator
from dataclasses import dataclass, field
from typing import Optional

from typing_extensions import Annotated


@dataclass(kw_only=True)
class SummaryState:
    research_topic: Optional[str] = None
    search_query: Optional[str] = None
    web_research_results: Annotated[list, operator.add] = field(default_factory=list)
    sources_gathered: Annotated[list, operator.add] = field(default_factory=list)
    research_loop_count: int = 0
    running_summary: Optional[str] = None


@dataclass(kw_only=True)
class SummaryStateInput:
    research_topic: Optional[str] = None


@dataclass(kw_only=True)
class SummaryStateOutput:
    running_summary: Optional[str] = None
