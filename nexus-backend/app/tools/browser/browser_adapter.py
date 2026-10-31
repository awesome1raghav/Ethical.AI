import asyncio
import logging
import os
import urllib.parse
from typing import List, Optional

from app.models.browser_result import BrowserResult

logger = logging.getLogger(__name__)


def _build_tools_with_tavily(api_key: str):
    """
    Registers a real Tavily search action on top of browser_use's default
    tool set (which only offers DuckDuckGo/Google/Bing -- a raw search-results
    page the agent still has to click through and scrape by hand).

    Without this, the agent's only path to information is autonomous DOM
    scraping: it repeatedly landed on trade blogs and search-result snippets
    for technical topics, and a real mission's own VALIDATE step correctly
    flagged the result as unverifiable ("no primary, technical, or
    peer-reviewed sources exist"). Tavily returns curated source content
    directly from one real API call -- higher-authority results without a
    page render, and a real alternative for the agent to choose when it
    decides scraped web pages aren't good enough.
    """
    import httpx
    from pydantic import BaseModel
    from browser_use import Tools
    from browser_use.agent.views import ActionResult

    class TavilySearchAction(BaseModel):
        query: str

    tools = Tools()

    @tools.registry.action(
        "Search the web via Tavily to quickly discover candidate source URLs "
        "and preview snippets for a query. Prefer this over the generic "
        "'search' action to find sources -- it returns higher-authority "
        "candidates than a raw search-results page. This is discovery only: "
        "the snippet text is a preview, not a citation-ready source. For any "
        "URL you intend to cite in your final report, you must still "
        "navigate to it with go_to_url and call extract_content to capture "
        "and confirm its real content before citing it.",
        param_model=TavilySearchAction,
        terminates_sequence=True,  # matches the default `search` action -- force
        # the agent to actually read one call's real result before queuing
        # another; without this it batched multiple calls per turn and lost
        # every result but the last (observed live: it self-diagnosed this
        # exact failure and fell back to page-scraping after 3 attempts).
    )
    async def tavily_search(params: TavilySearchAction) -> ActionResult:
        try:
            resp = httpx.post(
                "https://api.tavily.com/search",
                json={
                    "api_key": api_key,
                    "query": params.query,
                    "search_depth": "advanced",
                    "max_results": 6,
                    "include_answer": False,
                },
                timeout=30,
            )
            resp.raise_for_status()
            results = resp.json().get("results", [])
        except Exception as exc:
            return ActionResult(error=f"Tavily search failed: {exc}")

        if not results:
            return ActionResult(
                extracted_content=f"Tavily returned no results for '{params.query}'.",
            )

        content = "\n\n".join(
            f"### {r.get('title', '(untitled)')}\nURL: {r.get('url', '')}\n{(r.get('content') or '')[:1500]}"
            for r in results
        )
        # long_term_memory is intentionally left unset: ActionResult only
        # promotes extracted_content into the agent's persistent memory
        # automatically when no long_term_memory is explicitly provided (see
        # browser_use.agent.views.ActionResult) -- passing a short summary
        # here, as the first version of this action did, silently discarded
        # the real content after a single step instead of keeping it.
        return ActionResult(extracted_content=content[:8000])

    return tools

# Deferred, not top-level: app.agents/__init__.py eagerly imports BrowserAgent,
# which imports this module -- a top-level import back into app.agents here
# would be a circular import. By the time run_task() actually executes, every
# module involved has finished loading, so importing here is safe.
def _capability_unavailable_error():
    from app.agents.step_execution import CapabilityUnavailableError
    return CapabilityUnavailableError


class BrowserAdapter:
    """
    Isolates the browsing backends (browser_use, then Playwright) from agents.

    Every path either returns content produced by a real browser action or
    raises CapabilityUnavailableError with the specific reason; placeholder
    results are never returned.
    """

    @staticmethod
    def is_available() -> bool:
        try:
            import browser_use  # noqa: F401
            return True
        except ImportError:
            return False

    @staticmethod
    def _get_browser_use_llm(task_description: str):
        """browser_use runs on local Gemma 4 12B via Ollama. None if unavailable."""
        from app.services.llm import MODEL, llm_available
        from app.services.llm.gemma_client import OLLAMA_URL
        if not llm_available():
            logger.warning("browser_use requested but Gemma (%s) is not available on Ollama.", MODEL)
            return None
        try:
            from browser_use.llm import ChatOllama
            logger.info("browser_use LLM: %s via ChatOllama", MODEL)
            return ChatOllama(model=MODEL, host=OLLAMA_URL)
        except Exception as exc:
            logger.warning("browser_use has no usable Ollama wiring (%s).", exc)
            return None

    @staticmethod
    def run_task(task_description: str, llm=None, headless: bool = True) -> List[BrowserResult]:
        errors: List[str] = []

        # 1. Autonomous Browser Use Agent
        if BrowserAdapter.is_available():
            try:
                if not llm:
                    llm = BrowserAdapter._get_browser_use_llm(task_description)

                if llm is None:
                    errors.append("browser_use is installed but the local Gemma model "
                                  "is not available on Ollama")
                else:
                    from browser_use import Agent as BrowserUseAgent

                    model_name = getattr(llm, "model", getattr(llm, "model_name", "LLM"))

                    tavily_key = os.environ.get("TAVILY_API_KEY", "").strip()
                    tools = _build_tools_with_tavily(tavily_key) if tavily_key else None
                    if tools:
                        logger.info("Tavily search tool registered for this browsing task")
                    else:
                        logger.warning(
                            "TAVILY_API_KEY not configured -- browsing falls back to "
                            "DuckDuckGo/Google/Bing page scraping only"
                        )

                    # Tavily's tool description alone was not enough: given a
                    # fast, reliable, terminates-sequence action that returns
                    # clean text immediately, the agent simply never called
                    # go_to_url/extract_content again -- it never visited a
                    # real page for the rest of the run. That produced good
                    # text but no real visited-URL trail, which is exactly
                    # what a real mission's VALIDATE step later flagged as
                    # unverifiable ("browser-use.local/session" / "about:blank"
                    # pseudo-sources). This system-prompt addendum makes
                    # visiting the page a hard requirement before citing it,
                    # not just a suggestion buried in one tool's description.
                    browsing_instructions = (
                        "Citation rule: tavily_search finds candidate URLs -- it does "
                        "not verify them. Before citing ANY source in your final "
                        "output, you must have actually visited it in this step "
                        "sequence: call go_to_url with its real URL, then "
                        "extract_content on that page. A source you only saw in a "
                        "tavily_search snippet and never navigated to may not be "
                        "cited as verified. Do this for at least the top 2-3 most "
                        "important sources per research area, not every result."
                    )

                    agent = BrowserUseAgent(
                        task=task_description,
                        llm=llm,
                        tools=tools,
                        extend_system_message=browsing_instructions,
                    )

                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                    try:
                        history = loop.run_until_complete(agent.run())
                    finally:
                        loop.close()

                    final_res_str = str(history.final_result()) if hasattr(history, "final_result") else str(history)

                    results = [BrowserResult(
                        title=f"{task_description} - Autonomous Agent Report",
                        url="https://browser-use.local/session",
                        content=final_res_str,
                        status="SUCCESS",
                        source=f"BrowserUseAgent({model_name})",
                    )]

                    # Record what the agent's extract actions pulled from each page.
                    visited_urls = list(history.urls()) if hasattr(history, "urls") and callable(history.urls) else []
                    extracted = list(history.extracted_content()) if hasattr(history, "extracted_content") and callable(history.extracted_content) else []
                    for i, content in enumerate(extracted):
                        results.append(BrowserResult(
                            title=f"Autonomous extraction {i + 1}",
                            url=visited_urls[i] if i < len(visited_urls) else f"https://browser-use.local/session/extract-{i + 1}",
                            content=content,
                            status="SUCCESS",
                            source="BrowserUseAgent/Extraction",
                        ))
                    return results
            except Exception as bu_err:
                errors.append(f"BrowserUseAgent run failed: {bu_err}")
        else:
            errors.append("browser_use is not installed")

        # 2. Playwright, real navigation only -- no fabricated results appended
        # around whatever real content it retrieves.
        try:
            from playwright.sync_api import sync_playwright
        except ImportError:
            errors.append("playwright is not installed")
        else:
            try:
                query = urllib.parse.quote(task_description)
                search_url = f"https://www.google.com/search?q={query}"

                with sync_playwright() as p:
                    browser = p.chromium.launch(headless=headless)
                    page = browser.new_page()
                    page.goto(search_url, timeout=10000, wait_until="commit")
                    page_title = page.title() or search_url
                    page_content = page.content()
                    browser.close()

                    return [BrowserResult(
                        title=page_title,
                        url=search_url,
                        content=page_content[:5000],
                        status="SUCCESS",
                        source="Playwright/Chromium",
                    )]
            except Exception as pe:
                errors.append(f"Playwright navigation failed: {pe}")

        # Neither backend produced a real result. Say so -- do not synthesize
        # a result shaped like one.
        raise _capability_unavailable_error()(
            "No real browsing capability is available for this task. "
            + "; ".join(errors)
        )
