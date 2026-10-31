"""
Estimated agents for the Intelligence Panel.

Runs the deterministic Planner so the panel reports the agents the mission would
actually draw, taken from the plan's steps rather than guessed from intent. Both
the Decision Engine and the Planner are pure and take about a millisecond, so
previewing costs nothing and the preview cannot disagree with the real run.
"""

from collections import Counter
from typing import Dict, List, Tuple


def preview_agents(record) -> Tuple[List[str], List[Dict[str, str]]]:
    try:
        from app.services.agent_registry.agent_factory import AgentFactory
        from app.services.planner.planner_service import PlannerInput, PlannerService

        plan = PlannerService.generate_plan(
            PlannerInput(prompt=record.prompt, decision_record=record))
        if not plan.steps:
            return [], []

        assignments = AgentFactory.assign(plan)
        counts = Counter(a.agent.value for a in assignments)

        by_agent: Dict[str, List[str]] = {}
        for step, assignment in zip(plan.steps, assignments):
            by_agent.setdefault(assignment.agent.value, []).append(step.action)

        agents = [name for name, _ in counts.most_common()]
        breakdown = [
            {
                "agent": name,
                "steps": str(counts[name]),
                "does": "; ".join(by_agent[name][:3])
                + ("…" if len(by_agent[name]) > 3 else ""),
            }
            for name in agents
        ]
        return agents, breakdown
    except Exception:
        # The panel must never fail because a preview could not be produced.
        return [], []
