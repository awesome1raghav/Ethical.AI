"""
Planner type system.

The old PlanStep carried three fields -- step, capability, action -- which is
why governance had nothing to reason about. Risk here is a declared property of
a typed operation, not a substring of a display string.
"""

from dataclasses import dataclass, field, replace
from enum import Enum
from typing import Dict, List, Optional


class OperationType(str, Enum):
    """Closed set of things a step can actually do. Risk attaches here."""

    # filesystem
    READ_FILE = "READ_FILE"
    WRITE_FILE = "WRITE_FILE"
    DELETE_FILE = "DELETE_FILE"
    # analysis / synthesis
    ANALYZE = "ANALYZE"
    COMPARE = "COMPARE"
    SUMMARIZE = "SUMMARIZE"
    DESIGN = "DESIGN"
    # code
    IMPLEMENT = "IMPLEMENT"
    CONFIGURE = "CONFIGURE"
    RUN_TESTS = "RUN_TESTS"
    # external
    NETWORK_REQUEST = "NETWORK_REQUEST"
    DEPLOY = "DEPLOY"
    SEND_MESSAGE = "SEND_MESSAGE"      # email, chat, notification -- cannot be unsent
    # data
    DATABASE_READ = "DATABASE_READ"
    DATABASE_WRITE = "DATABASE_WRITE"
    DATABASE_DELETE = "DATABASE_DELETE"
    CREDENTIAL_ACCESS = "CREDENTIAL_ACCESS"
    # output
    GENERATE_ARTIFACT = "GENERATE_ARTIFACT"
    VALIDATE = "VALIDATE"


class EdgeKind(str, Enum):
    PREREQUISITE = "prerequisite"      # B needs A's output
    SEQUENTIAL = "sequential"          # ordering without data flow
    VALIDATION = "validation"          # checks the step it follows
    TERMINAL = "terminal"              # final deliverable


class ExecutionStrategy(str, Enum):
    SINGLE_STEP = "SINGLE_STEP"
    SEQUENTIAL = "SEQUENTIAL"
    PARALLELIZABLE = "PARALLELIZABLE"
    PHASED = "PHASED"


@dataclass(frozen=True)
class RiskSurface:
    """
    What a step touches. HELIX and MATRIX read these booleans instead of
    grepping display strings, so a destructive operation is legible to
    governance whatever wording the user used.
    """
    filesystem_read: bool = False
    filesystem_write: bool = False
    network_access: bool = False
    database_read: bool = False
    database_write: bool = False
    credential_access: bool = False
    code_execution: bool = False
    destructive: bool = False
    reversible: bool = True
    external_side_effect: bool = False

    FLAGS = ("filesystem_read", "filesystem_write", "network_access",
             "database_read", "database_write", "credential_access",
             "code_execution", "destructive", "external_side_effect")

    def union(self, other: "RiskSurface") -> "RiskSurface":
        return RiskSurface(
            **{f: getattr(self, f) or getattr(other, f) for f in RiskSurface.FLAGS},
            # a plan is reversible only if every part of it is
            reversible=self.reversible and other.reversible,
        )

    @property
    def active(self) -> List[str]:
        return [f for f in RiskSurface.FLAGS if getattr(self, f)]

    @property
    def severity(self) -> int:
        """0 inert, 1 reads, 2 writes, 3 external effect, 4 irreversible destruction."""
        if self.destructive and not self.reversible:
            return 4
        if self.destructive or self.external_side_effect:
            return 3
        if self.filesystem_write or self.database_write or self.code_execution:
            return 2
        if self.filesystem_read or self.database_read or self.network_access:
            return 1
        return 0

    def to_dict(self) -> dict:
        d = {f: getattr(self, f) for f in RiskSurface.FLAGS}
        d["reversible"] = self.reversible
        return d


@dataclass
class PlanStep:
    step_id: str
    action: str                       # short imperative, e.g. "Migrate source files"
    description: str
    purpose: str
    operation: OperationType
    capability: str
    tool: Optional[str] = None
    inputs: List[str] = field(default_factory=list)
    expected_output: str = ""
    depends_on: List[str] = field(default_factory=list)
    risk_surface: RiskSurface = field(default_factory=RiskSurface)
    reversible: bool = True
    requires_human_approval: bool = False
    validation: Optional[str] = None
    failure_strategy: str = "halt"

    def to_dict(self) -> dict:
        return {
            "step_id": self.step_id,
            "action": self.action,
            "description": self.description,
            "purpose": self.purpose,
            "operation": self.operation.value,
            "capability": self.capability,
            "tool": self.tool,
            "inputs": self.inputs,
            "expected_output": self.expected_output,
            "depends_on": self.depends_on,
            "risk_surface": self.risk_surface.to_dict(),
            "reversible": self.reversible,
            "requires_human_approval": self.requires_human_approval,
            "validation": self.validation,
            "failure_strategy": self.failure_strategy,
        }


@dataclass
class DependencyEdge:
    from_step: str
    to_step: str
    kind: EdgeKind = EdgeKind.PREREQUISITE

    def to_dict(self) -> dict:
        return {"from": self.from_step, "to": self.to_step, "kind": self.kind.value}


@dataclass
class Plan:
    plan_id: str
    mission_id: Optional[str]
    objective: str
    complexity: str
    estimated_steps: int               # what the Decision Engine predicted
    steps: List[PlanStep] = field(default_factory=list)
    edges: List[DependencyEdge] = field(default_factory=list)
    required_capabilities: List[str] = field(default_factory=list)
    execution_strategy: ExecutionStrategy = ExecutionStrategy.SEQUENTIAL
    risk_summary: RiskSurface = field(default_factory=RiskSurface)
    validation_requirements: List[str] = field(default_factory=list)
    parallel_groups: List[List[str]] = field(default_factory=list)
    deviation: int = 0
    deviation_reason: str = ""
    notes: List[str] = field(default_factory=list)

    @property
    def actual_steps(self) -> int:
        return len(self.steps)

    @property
    def requires_human_approval(self) -> bool:
        return any(s.requires_human_approval for s in self.steps)

    def step(self, step_id: str) -> Optional[PlanStep]:
        return next((s for s in self.steps if s.step_id == step_id), None)

    def to_dict(self) -> dict:
        return {
            "plan_id": self.plan_id,
            "mission_id": self.mission_id,
            "objective": self.objective,
            "complexity": self.complexity,
            "estimated_steps": self.estimated_steps,
            "actual_steps": self.actual_steps,
            "steps": [s.to_dict() for s in self.steps],
            "dependencies": [e.to_dict() for e in self.edges],
            "required_capabilities": self.required_capabilities,
            "execution_strategy": self.execution_strategy.value,
            "risk_summary": self.risk_summary.to_dict(),
            "validation_requirements": self.validation_requirements,
            "parallel_groups": self.parallel_groups,
            "deviation": self.deviation,
            "deviation_reason": self.deviation_reason,
            "requires_human_approval": self.requires_human_approval,
            "notes": self.notes,
        }


def rehydrate_plan(d: dict) -> "Plan":
    """
    Reconstruct a typed Plan from Plan.to_dict()'s JSON shape -- the mirror of
    to_dict(), needed to resume a checkpointed mission with real OperationType/
    ExecutionStrategy enums rather than bare strings AgentExecutor can't compare
    against.
    """
    risk = d.get("risk_summary", {})
    risk_summary = RiskSurface(
        **{k: v for k, v in risk.items() if k in RiskSurface.FLAGS or k == "reversible"}
    )

    steps = []
    for sd in d.get("steps", []):
        sr = sd.get("risk_surface", {})
        steps.append(PlanStep(
            step_id=sd["step_id"],
            action=sd["action"],
            description=sd["description"],
            purpose=sd["purpose"],
            operation=OperationType(sd["operation"]),
            capability=sd["capability"],
            tool=sd.get("tool"),
            inputs=list(sd.get("inputs", [])),
            expected_output=sd.get("expected_output", ""),
            depends_on=list(sd.get("depends_on", [])),
            risk_surface=RiskSurface(
                **{k: v for k, v in sr.items() if k in RiskSurface.FLAGS or k == "reversible"}
            ),
            reversible=sd.get("reversible", True),
            requires_human_approval=sd.get("requires_human_approval", False),
            validation=sd.get("validation"),
            failure_strategy=sd.get("failure_strategy", "halt"),
        ))

    edges = [
        DependencyEdge(from_step=e["from"], to_step=e["to"], kind=EdgeKind(e["kind"]))
        for e in d.get("dependencies", [])
    ]

    return Plan(
        plan_id=d["plan_id"],
        mission_id=d.get("mission_id"),
        objective=d["objective"],
        complexity=d["complexity"],
        estimated_steps=d["estimated_steps"],
        steps=steps,
        edges=edges,
        required_capabilities=list(d.get("required_capabilities", [])),
        execution_strategy=ExecutionStrategy(d["execution_strategy"]),
        risk_summary=risk_summary,
        validation_requirements=list(d.get("validation_requirements", [])),
        parallel_groups=list(d.get("parallel_groups", [])),
        deviation=d.get("deviation", 0),
        deviation_reason=d.get("deviation_reason", ""),
        notes=list(d.get("notes", [])),
    )
