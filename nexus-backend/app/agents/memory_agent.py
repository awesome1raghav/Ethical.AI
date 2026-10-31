"""MemoryAgent: long-term memory is not implemented yet."""

from .base_agent import BaseAgent
from .step_execution import CapabilityUnavailableError


class MemoryAgent(BaseAgent):

    name = "MemoryAgent"

    def run(self, context):
        return context

    def run_step(self, step, context):
        raise CapabilityUnavailableError("Long-term memory storage is not implemented.")
