"""
Agent assignment.

Agents are assigned from each step's declared operation, so a plan that reads
files, writes code, runs tests and generates docs draws four different agents.
"""


from app.services.planner.models import OperationType as OT

from .agent_models import AgentType, AssignedAgent
from .registry import AgentRegistry

OPERATION_AGENTS = {
    OT.READ_FILE: AgentType.FILE,
    OT.WRITE_FILE: AgentType.FILE,
    OT.DELETE_FILE: AgentType.FILE,
    OT.ANALYZE: AgentType.REASONING,
    OT.COMPARE: AgentType.REASONING,
    OT.DESIGN: AgentType.REASONING,
    OT.SUMMARIZE: AgentType.SUMMARY,
    OT.IMPLEMENT: AgentType.CODING,
    OT.CONFIGURE: AgentType.CODING,
    OT.RUN_TESTS: AgentType.CODING,
    OT.DEPLOY: AgentType.CODING,
    OT.NETWORK_REQUEST: AgentType.RESEARCH,
    OT.SEND_MESSAGE: AgentType.CHAT,
    OT.DATABASE_READ: AgentType.REASONING,
    OT.DATABASE_WRITE: AgentType.REASONING,
    OT.DATABASE_DELETE: AgentType.REASONING,
    OT.CREDENTIAL_ACCESS: AgentType.REASONING,
    OT.GENERATE_ARTIFACT: AgentType.REPORT,
    OT.VALIDATE: AgentType.REASONING,
}


class AgentFactory:

    @staticmethod
    def assign(plan):
        steps = getattr(plan, "steps", None)

        if steps is None:
            # Legacy plan shape: capability is all there is.
            return [
                AssignedAgent(step=s.step, capability=s.capability,
                              agent=AgentRegistry.get_agent(s.capability))
                for s in plan
            ]

        assignments = []
        for idx, step in enumerate(steps, start=1):
            agent = OPERATION_AGENTS.get(step.operation)
            if agent is None:
                agent = AgentRegistry.get_agent(step.capability)
            assignments.append(AssignedAgent(
                step=idx, capability=step.capability, agent=agent))
        return assignments
