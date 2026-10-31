"""Web search backends and helpers for formatting their results.

Every backend returns ``{"results": [{"title", "url", "content", "raw_content"}]}``.
"""

import logging
import os
import urllib.request
from typing import Any

logger = logging.getLogger(__name__)

SearchResponse = dict[str, list[dict[str, Any]]]

try:  # The DuckDuckGo client was renamed from duckduckgo_search to ddgs.
    from ddgs import DDGS
except ImportError:  # pragma: no cover - depends on installed package
    try:
        from duckduckgo_search import DDGS
    except ImportError:
        DDGS = None


def _fetch_page_text(url: str, timeout: int = 10) -> str | None:
    """Download a page and return its visible text, or None on failure."""
    try:
        from bs4 import BeautifulSoup

        with urllib.request.urlopen(url, timeout=timeout) as response:
            return BeautifulSoup(response.read(), "html.parser").get_text()
    except Exception as exc:  # noqa: BLE001 - any fetch failure falls back to the snippet
        logger.warning("Could not fetch full page %s: %s", url, exc)
        return None


def duckduckgo_search(query: str, max_results: int = 3, fetch_full_page: bool = False) -> SearchResponse:
    """Search the web with DuckDuckGo (no API key required)."""
    if DDGS is None:
        logger.error("DuckDuckGo search is unavailable. Install it with: pip install ddgs")
        return {"results": []}

    try:
        raw_results = list(DDGS().text(query, max_results=max_results))
    except Exception as exc:  # noqa: BLE001
        logger.error("DuckDuckGo search failed for %r: %s", query, exc)
        return {"results": []}

    results = []
    for item in raw_results:
        # Older and newer client versions use different key names.
        url = item.get("href") or item.get("url")
        if not url:
            continue
        title = item.get("title") or "Untitled"
        content = item.get("body") or item.get("description") or item.get("snippet") or title
        raw_content = (_fetch_page_text(url) if fetch_full_page else None) or content
        results.append({"title": title, "url": url, "content": content, "raw_content": raw_content})

    logger.info("DuckDuckGo returned %d results for %r", len(results), query)
    return {"results": results}


def tavily_search(query: str, include_raw_content: bool = True, max_results: int = 3) -> SearchResponse:
    """Search the web with Tavily. Requires TAVILY_API_KEY."""
    api_key = os.getenv("TAVILY_API_KEY")
    if not api_key:
        raise ValueError("TAVILY_API_KEY is not set; use SEARCH_API=duckduckgo instead.")

    from tavily import TavilyClient

    return TavilyClient(api_key=api_key).search(
        query, max_results=max_results, include_raw_content=include_raw_content
    )


def deduplicate_and_format_sources(
    search_response: SearchResponse | list[SearchResponse],
    max_tokens_per_source: int,
    include_raw_content: bool = False,
) -> str:
    """Merge one or more search responses into a single prompt-ready text block."""
    responses = search_response if isinstance(search_response, list) else [search_response]

    unique_sources: dict[str, dict[str, Any]] = {}
    for response in responses:
        for source in response.get("results", []):
            unique_sources.setdefault(source["url"], source)

    char_limit = max_tokens_per_source * 4  # Rough estimate: ~4 characters per token.
    blocks = []
    for source in unique_sources.values():
        block = (
            f"Source {source['title']}:\n===\n"
            f"URL: {source['url']}\n===\n"
            f"Most relevant content from source: {source['content']}\n===\n"
        )
        if include_raw_content:
            raw = source.get("raw_content") or ""
            if len(raw) > char_limit:
                raw = raw[:char_limit] + "... [truncated]"
            block += f"Full source content limited to {max_tokens_per_source} tokens: {raw}\n"
        blocks.append(block)

    return ("Sources:\n\n" + "\n".join(blocks)).strip()


def format_sources(search_response: SearchResponse) -> str:
    """Render search results as a Markdown bullet list of titles and URLs."""
    results = search_response.get("results", [])
    if not results:
        return "* No sources found."
    return "\n".join(f"* {s.get('title', 'Untitled')} : {s.get('url', '')}" for s in results)
