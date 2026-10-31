"""
Planner adapters for the evaluation harness.

Normalises whatever a planner produces into one shape so the current
capability-template planner and its replacement can be scored on the same
fixture. Fields the current planner has no concept of (dependencies, tools,
risk surfaces, reversibility) are reported as absent rather than faked --
their absence is itself a measurement.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class NormStep:
    step_id: str
    action: str
    description: str = ""
    capability: str = ""
    tool: Optional[str] = None
    depends_on: List[str] = field(default_factory=list)
    operation: Optional[str] = None          # READ_FILE, DATABASE_DELETE, ...
    destructive: Optional[bool] = None
    reversible: Optional[bool] = None
    requires_human_approval: Optional[bool] = None


@dataclass
class NormPlan:
    steps: List[NormStep] = field(default_factory=list)
    capabilities: List[str] = field(default_factory=list)
    estimated_steps: Optional[int] = None      # what the Decision Engine predicted
    supports_dependencies: bool = False
    supports_risk_surface: bool = False
    supports_tools: bool = False
    raw: Any = None

    @property
    def fingerprint(self) -> str:
        """Identity of the plan's shape -- two prompts yielding the same
        fingerprint have received literally the same plan."""
        import hashlib
        body = "|".join(f"{s.action}" for s in self.steps)
        return hashlib.sha1(body.encode()).hexdigest()[:10]


def current_planner(prompt: str) -> NormPlan:
    """Today's pipeline: DecisionService -> CapabilityService -> PlannerService."""
    from app.services.decision import DecisionService
    from app.services.capability.capability_service import CapabilityService
    from app.services.planner.planner_service import PlannerService

    decision = DecisionService.decide(prompt)
    caps = CapabilityService.detect(decision.intent)
    plan = PlannerService.generate(caps)

    return NormPlan(
        steps=[
            NormStep(
                step_id=str(s.step),
                action=s.action,
                capability=s.capability,
            )
            for s in plan
        ],
        capabilities=[c.value for c in caps],
        estimated_steps=decision.estimated_steps,
        supports_dependencies=False,
        supports_risk_surface=False,
        supports_tools=False,
        raw=plan,
    )


def new_planner(prompt: str) -> NormPlan:
    """Prompt + DecisionRecord -> typed Plan with a dependency DAG."""
    from app.services.decision import DecisionService
    from app.services.planner.planner_service import PlannerService, PlannerInput

    decision = DecisionService.decide(prompt)
    plan = PlannerService.generate_plan(
        PlannerInput(prompt=prompt, decision_record=decision))

    return NormPlan(
        steps=[
            NormStep(
                step_id=s.step_id,
                action=s.action,
                description=s.description,
                capability=s.capability,
                tool=s.tool,
                depends_on=list(s.depends_on),
                operation=s.operation.value,
                destructive=s.risk_surface.destructive,
                reversible=s.reversible,
                requires_human_approval=s.requires_human_approval,
            )
            for s in plan.steps
        ],
        capabilities=plan.required_capabilities,
        estimated_steps=plan.estimated_steps,
        supports_dependencies=True,
        supports_risk_surface=True,
        supports_tools=True,
        raw=plan,
    )


ADAPTERS = {
    "current": current_planner,
    "new": new_planner,
}
