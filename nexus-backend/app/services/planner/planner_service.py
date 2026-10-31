"""
Mission Planner.

Replaces the capability-template planner, which produced one step per capability
and therefore returned the same plan for every mission sharing an intent. This
one plans from the prompt and the DecisionRecord:

    prompt + DecisionRecord
        -> task clauses            (task_extractor)
        -> typed operations        (classifier)
        -> concrete sub-steps      (decomposition, scaled by complexity band)
        -> dependency DAG          (graph, from data flow)
        -> risk summary            (operations registry)

Deterministic: no model call, and the same input always yields the same plan.
"""

import hashlib
from dataclasses import dataclass, field
from typing import Any, List, Optional

from app.schemas.capability import Capability

from . import graph
from .classifier import classify
from .decomposition import decompose
from .models import (ExecutionStrategy, Plan, PlanStep, RiskSurface)
from .operations import spec
from .reconciler import reconcile
from .task_extractor import extract


@dataclass
class PlannerInput:
    prompt: str
    decision_record: Any = None
    mission_id: Optional[str] = None
    available_capabilities: List[Capability] = field(default_factory=list)
    available_tools: List[str] = field(default_factory=list)
    environment_context: dict = field(default_factory=dict)


def _plan_id(prompt: str) -> str:
    return "plan_" + hashlib.sha1(prompt.strip().lower().encode()).hexdigest()[:8]


class PlannerService:

    @staticmethod
    def generate_plan(pi: PlannerInput) -> Plan:
        band = getattr(getattr(pi.decision_record, "complexity_band", None), "value", "MODERATE")
        estimated = getattr(pi.decision_record, "estimated_steps", 0) or 0

        clauses = extract(pi.prompt)
        steps: List[PlanStep] = []
        notes: List[str] = []
        counter = 1

        for clause in clauses:
            op = classify(clause)
            for sub in decompose(clause, op, band):
                s = spec(sub.operation)
                risk = s.risk
                steps.append(PlanStep(
                    step_id=f"s{counter}",
                    action=sub.action,
                    description=sub.description,
                    purpose=sub.purpose,
                    operation=sub.operation,
                    capability=s.capability.value,
                    tool=s.tool,
                    inputs=list(sub.inputs),
                    expected_output=sub.expected_output,
                    risk_surface=risk,
                    reversible=risk.reversible,
                    requires_human_approval=s.requires_human_approval,
                    validation=sub.validation or s.default_validation,
                    failure_strategy=s.failure_strategy,
                ))
                counter += 1

        if not clauses:
            notes.append("No actionable task clause found in the prompt; "
                         "the request needs clarification before it can be planned.")

        edges = graph.build_edges(steps)
        graph.apply_edges(steps, edges)

        cycle = graph.detect_cycle(steps)
        if cycle:
            notes.append(f"Dependency cycle detected and broken: {' -> '.join(cycle)}")
            for sid in cycle[1:]:
                st = next((x for x in steps if x.step_id == sid), None)
                if st and cycle[0] in st.depends_on:
                    st.depends_on.remove(cycle[0])
            edges = [e for e in edges if not (e.from_step == cycle[0] and e.to_step in cycle[1:])]

        groups = graph.parallel_groups(steps)
        risk_summary = RiskSurface()
        for s in steps:
            risk_summary = risk_summary.union(s.risk_surface)

        deviation, reason = reconcile(estimated, steps, len(clauses), band)

        return Plan(
            plan_id=_plan_id(pi.prompt),
            mission_id=pi.mission_id,
            objective=pi.prompt.strip(),
            complexity=band,
            estimated_steps=estimated,
            steps=steps,
            edges=edges,
            required_capabilities=sorted({s.capability for s in steps}),
            execution_strategy=graph.strategy_for(groups, len(steps)),
            risk_summary=risk_summary,
            validation_requirements=[s.validation for s in steps if s.validation],
            parallel_groups=groups,
            deviation=deviation,
            deviation_reason=reason,
            notes=notes,
        )

    # ------------------------------------------------------------------
    # Deprecated. The capability-template planner, kept only so anything
    # still calling generate(capabilities) keeps working until it is migrated.
    # It cannot see the prompt, so it cannot plan the mission.
    # ------------------------------------------------------------------
    @staticmethod
    def generate(capabilities):
        from app.schemas.planner import LegacyPlanStep

        actions = {
            Capability.BROWSER: "Launch Browser", Capability.WEB_SEARCH: "Search Internet",
            Capability.SUMMARIZATION: "Summarize Results", Capability.CITATION: "Collect Citations",
            Capability.REPORT: "Generate Report", Capability.CODING: "Generate Code",
            Capability.FILE: "Create Files", Capability.REASONING: "Reason About Task",
            Capability.CHAT: "Generate Response", Capability.MEMORY: "Retrieve Conversation",
        }
        return [
            LegacyPlanStep(step=i, capability=c.value, action=actions.get(c, "Unknown"))
            for i, c in enumerate(capabilities, start=1)
        ]
