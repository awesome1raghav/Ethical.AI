from .agent_models import AgentType
from .builtin_agents import BUILTIN_AGENTS


class AgentRegistry:

    @staticmethod
    def get_agent(capability):

        return BUILTIN_AGENTS.get(capability, AgentType.CHAT)
