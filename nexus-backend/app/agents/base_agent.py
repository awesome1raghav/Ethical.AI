import logging
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)


class BaseAgent(ABC):

    name = "BaseAgent"

    def pre_execute(self, context):

        logger.debug("%s starting", self.name)

    @abstractmethod
    def run(self, context):

        pass

    def post_execute(self, context):

        logger.debug("%s finished", self.name)

    def execute(self, context):

        self.pre_execute(context)

        context = self.run(context)

        self.post_execute(context)

        return context

    def run_step(self, step, context):
        """
        Execute one plan step. Prior step outputs are on context.step_results.

        Returns the step's output as a string, or the mutated ExecutionContext
        for agents that only implement the whole-context run().
        """
        return self.execute(context)
