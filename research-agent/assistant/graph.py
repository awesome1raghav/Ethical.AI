"""LangGraph research loop: query -> search -> summarize -> reflect, repeated.

Adapted from LangChain's Ollama Deep Researcher (MIT), see ../NOTICE.
"""

import json
import logging
import re

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.runnables import RunnableConfig
from langchain_ollama import ChatOllama
from langgraph.graph import END, START, StateGraph
from typing_extensions import Literal

from assistant.configuration import Configuration, SearchAPI
from assistant.prompts import query_writer_instructions, reflection_instructions, summarizer_instructions
from assistant.search import deduplicate_and_format_sources, duckduckgo_search, format_sources, tavily_search
from assistant.state import SummaryState, SummaryStateInput, SummaryStateOutput

logger = logging.getLogger(__name__)

MAX_TOKENS_PER_SOURCE = 1000
_THINK_BLOCK = re.compile(r"<think>.*?</think>", re.DOTALL)


def _llm(config: RunnableConfig, json_mode: bool = False) -> ChatOllama:
    cfg = Configuration.from_runnable_config(config)
    return ChatOllama(
        base_url=cfg.ollama_base_url,
        model=cfg.local_llm,
        temperature=0,
        **({"format": "json"} if json_mode else {}),
    )


def _parse_json(text: str) -> dict:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        logger.warning("Model returned invalid JSON: %.200s", text)
        return {}


def generate_query(state: SummaryState, config: RunnableConfig) -> dict:
    """Write the first web search query for the topic."""
    result = _llm(config, json_mode=True).invoke([
        SystemMessage(content=query_writer_instructions.format(research_topic=state.research_topic)),
        HumanMessage(content="Generate a query for web search:"),
    ])
    query = _parse_json(result.content).get("query") or state.research_topic
    return {"search_query": query}


def web_research(state: SummaryState, config: RunnableConfig) -> dict:
    """Run the current query against the configured search backend."""
    cfg = Configuration.from_runnable_config(config)

    if cfg.search_api is SearchAPI.TAVILY:
        results = tavily_search(state.search_query, include_raw_content=True, max_results=1)
    else:
        results = duckduckgo_search(state.search_query, max_results=3, fetch_full_page=cfg.fetch_full_page)

    return {
        "sources_gathered": [format_sources(results)],
        "research_loop_count": state.research_loop_count + 1,
        "web_research_results": [
            deduplicate_and_format_sources(results, MAX_TOKENS_PER_SOURCE, include_raw_content=True)
        ],
    }


def summarize_sources(state: SummaryState, config: RunnableConfig) -> dict:
    """Fold the latest search results into the running summary."""
    existing = state.running_summary
    latest = state.web_research_results[-1] if state.web_research_results else ""

    if not latest or latest.strip() == "Sources:":
        note = f"No web search results were found for: {state.research_topic}."
        return {"running_summary": f"{existing}\n\n{note}" if existing else note}

    sections = [f"<User Input>\n{state.research_topic}\n</User Input>"]
    if existing:
        sections.append(f"<Existing Summary>\n{existing}\n</Existing Summary>")
        sections.append(f"<New Search Results>\n{latest}\n</New Search Results>")
    else:
        sections.append(f"<Search Results>\n{latest}\n</Search Results>")

    result = _llm(config).invoke([
        SystemMessage(content=summarizer_instructions),
        HumanMessage(content="\n\n".join(sections)),
    ])
    # Reasoning models may emit <think> blocks; keep only the answer.
    return {"running_summary": _THINK_BLOCK.sub("", result.content).strip()}


def reflect_on_summary(state: SummaryState, config: RunnableConfig) -> dict:
    """Find a knowledge gap in the summary and write a follow-up query."""
    result = _llm(config, json_mode=True).invoke([
        SystemMessage(content=reflection_instructions.format(research_topic=state.research_topic)),
        HumanMessage(content=(
            "Identify a knowledge gap and generate a follow-up web search query "
            f"based on our existing knowledge: {state.running_summary}"
        )),
    ])
    query = _parse_json(result.content).get("follow_up_query")
    return {"search_query": query or f"Tell me more about {state.research_topic}"}


def finalize_summary(state: SummaryState) -> dict:
    """Append the de-duplicated source list to the final summary."""
    seen: set[str] = set()
    sources = []
    for block in state.sources_gathered:
        for line in block.splitlines():
            if line not in seen:
                seen.add(line)
                sources.append(line)
    return {"running_summary": f"## Summary\n\n{state.running_summary}\n\n### Sources\n" + "\n".join(sources)}


def route_research(state: SummaryState, config: RunnableConfig) -> Literal["web_research", "finalize_summary"]:
    """Continue searching until the configured number of loops has run."""
    cfg = Configuration.from_runnable_config(config)
    return "web_research" if state.research_loop_count < cfg.max_web_research_loops else "finalize_summary"


builder = StateGraph(SummaryState, input=SummaryStateInput, output=SummaryStateOutput, config_schema=Configuration)
builder.add_node("generate_query", generate_query)
builder.add_node("web_research", web_research)
builder.add_node("summarize_sources", summarize_sources)
builder.add_node("reflect_on_summary", reflect_on_summary)
builder.add_node("finalize_summary", finalize_summary)

builder.add_edge(START, "generate_query")
builder.add_edge("generate_query", "web_research")
builder.add_edge("web_research", "summarize_sources")
builder.add_edge("summarize_sources", "reflect_on_summary")
builder.add_conditional_edges("reflect_on_summary", route_research)
builder.add_edge("finalize_summary", END)

graph = builder.compile()
