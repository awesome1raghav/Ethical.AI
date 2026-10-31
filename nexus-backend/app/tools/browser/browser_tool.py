from typing import List
from .browser_adapter import BrowserAdapter
from app.models.browser_result import BrowserResult


class BrowserTool:

    @staticmethod
    def execute(task: str, llm=None) -> List[BrowserResult]:

        return BrowserAdapter.run_task(task, llm=llm)
