from .base_agent import BaseAgent
from .browser_agent import BrowserAgent


class ResearchAgent(BaseAgent):

    name = "ResearchAgent"

    def run_step(self, step, context):
        # run() stores results on context.research; return a short summary so
        # the step's recorded output shows what was found.
        context = self.run(context)
        docs = context.research.documents
        if not docs:
            return "No research documents were found for this query."
        lines = [
            f"- {getattr(d, 'title', '(untitled)')} ({getattr(d, 'url', 'no url')})"
            for d in docs
        ]
        return f"Found {len(docs)} source(s):\n" + "\n".join(lines)

    def run(self, context):

        context.emit("ResearchAgent", "RUNNING", "Launching BrowserAgent for research collection")

        browser = BrowserAgent()
        context = browser.execute(context)

        raw_results = context.research.browser_results
        deduped_docs = []
        seen_urls = set()

        for doc in raw_results:
            raw_url = getattr(doc, "url", "")
            normalized_url = raw_url.rstrip("/").strip().lower()

            if normalized_url and normalized_url not in seen_urls:
                seen_urls.add(normalized_url)
                deduped_docs.append(doc)

        context.research.documents = deduped_docs
        context.emit(
            "ResearchAgent",
            "SUCCESS",
            f"Normalized and deduplicated {len(deduped_docs)} research documents"
        )

        return context
