"""
Quick web research: one DuckDuckGo search, then a Gemma-written report.

For multi-round research with reflection, the frontend uses the separate
research-agent service instead; this path is the fast single-pass option.
"""

import logging

from app.services.llm import chat

logger = logging.getLogger(__name__)

MAX_RESULTS = 5
SNIPPET_CHARS = 500

SYSTEM_PROMPT = (
    "You are a research analyst. Using only the search results provided, write a "
    "clear, structured Markdown report with these sections: Summary, Key Findings "
    "(bullet points), and Sources (the URLs you relied on). If the results do not "
    "answer the query, say so plainly instead of guessing."
)


class ResearchUnavailable(RuntimeError):
    """Raised when search returns nothing or the model is unreachable."""


def search_web(query: str, max_results: int = MAX_RESULTS) -> list[dict]:
    """Return DuckDuckGo results as [{title, url, content}]."""
    try:
        from ddgs import DDGS
    except ImportError as exc:
        raise ResearchUnavailable("Web search requires the 'ddgs' package.") from exc

    try:
        raw = DDGS().text(query, max_results=max_results)
    except Exception as exc:  # noqa: BLE001 - network/search failures surface as unavailable
        raise ResearchUnavailable(f"Web search failed: {exc}") from exc

    return [
        {"title": r.get("title", "Untitled"), "url": r["href"], "content": r.get("body", "")}
        for r in raw
        if r.get("href")
    ]


def run_research(query: str) -> str:
    """Search the web for `query` and return a Markdown report."""
    results = search_web(query)
    if not results:
        raise ResearchUnavailable(f"No web results found for: {query}")

    sources = "\n\n".join(
        f"Source: {r['url']}\nTitle: {r['title']}\nContent: {r['content'][:SNIPPET_CHARS]}"
        for r in results
    )
    report = chat(
        [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Research query: {query}\n\nSearch results:\n{sources}"},
        ],
        temperature=0.2,
    )
    if not report:
        raise ResearchUnavailable("Gemma 4 12B is not reachable on Ollama.")

    logger.info("Research report generated for %r from %d sources", query, len(results))
    return report
