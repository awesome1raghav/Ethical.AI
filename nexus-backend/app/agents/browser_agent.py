from .base_agent import BaseAgent
from app.tools.browser import BrowserTool


class BrowserAgent(BaseAgent):

    name = "BrowserAgent"

    def run(self, context):

        context.emit("BrowserAgent", "RUNNING", f"Executing browser automation for prompt: '{context.prompt}'")

        results = BrowserTool.execute(context.prompt)
        
        context.browser_results = results
        context.emit("BrowserAgent", "SUCCESS", f"Collected {len(results)} browser results")

        return context
