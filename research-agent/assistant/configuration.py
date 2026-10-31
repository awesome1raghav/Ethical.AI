"""Runtime configuration for the research graph.

Defaults come from environment variables; per-request values passed through
LangGraph's ``configurable`` mapping take precedence over them.
"""

import os
from dataclasses import dataclass, fields
from enum import Enum
from typing import Any, Optional

from langchain_core.runnables import RunnableConfig


class SearchAPI(str, Enum):
    DUCKDUCKGO = "duckduckgo"
    TAVILY = "tavily"


def _env_bool(name: str, default: bool = False) -> bool:
    return os.environ.get(name, str(default)).strip().lower() in ("1", "true", "yes")


@dataclass(kw_only=True)
class Configuration:
    """Configurable fields for the research assistant."""

    max_web_research_loops: int = int(os.environ.get("MAX_WEB_RESEARCH_LOOPS", "2"))
    local_llm: str = os.environ.get("OLLAMA_MODEL", "gemma4:12b")
    ollama_base_url: str = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
    search_api: SearchAPI = SearchAPI(os.environ.get("SEARCH_API", SearchAPI.DUCKDUCKGO.value))
    fetch_full_page: bool = _env_bool("FETCH_FULL_PAGE")

    def __post_init__(self) -> None:
        self.max_web_research_loops = int(self.max_web_research_loops)
        self.search_api = SearchAPI(self.search_api)

    @classmethod
    def from_runnable_config(cls, config: Optional[RunnableConfig] = None) -> "Configuration":
        """Build a Configuration, letting per-request values override defaults."""
        configurable: dict[str, Any] = (config or {}).get("configurable", {})
        overrides = {
            f.name: configurable[f.name]
            for f in fields(cls)
            if f.init and configurable.get(f.name) is not None
        }
        return cls(**overrides)
