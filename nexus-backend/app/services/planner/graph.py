"""
Dependency graph.

Edges come from data flow: a step depends on the steps that produce the outputs
it declares as inputs. That is what yields real parallelism -- "Write tests" and
"Generate documentation" both consume "implementation" and neither consumes the
other, so they land in the same parallel group instead of an arbitrary chain.

A sequential fallback edge is added only where a step declares no satisfiable
input, so ordering is never silently invented for steps that could run
side by side.
"""

from typing import Dict, List, Set, Tuple

from .models import DependencyEdge, EdgeKind, ExecutionStrategy, PlanStep
from .models import OperationType as OT


def build_edges(steps: List[PlanStep]) -> List[DependencyEdge]:
    producers: Dict[str, str] = {}      # output token -> step_id
    edges: List[DependencyEdge] = []

    for step in steps:
        satisfied: Set[str] = set()

        for token in step.inputs:
            producer = producers.get(token)
            if producer and producer != step.step_id:
                satisfied.add(producer)

        if satisfied:
            for producer in sorted(satisfied):
                kind = (EdgeKind.VALIDATION if step.operation is OT.VALIDATE
                        else EdgeKind.PREREQUISITE)
                edges.append(DependencyEdge(producer, step.step_id, kind))
        elif steps.index(step) > 0:
            # No data dependency satisfied: fall back to the previous step so the
            # graph stays connected, but mark it as ordering rather than data flow.
            prev = steps[steps.index(step) - 1]
            edges.append(DependencyEdge(prev.step_id, step.step_id, EdgeKind.SEQUENTIAL))

        # Register outputs after wiring inputs so a step cannot depend on itself.
        if step.expected_output:
            producers.setdefault(step.expected_output, step.step_id)

    # Mark terminal steps.
    has_outgoing = {e.from_step for e in edges}
    for step in steps:
        if step.step_id not in has_outgoing and steps and step is steps[-1]:
            edges.append(DependencyEdge(step.step_id, step.step_id, EdgeKind.TERMINAL))

    return [e for e in edges if e.kind is not EdgeKind.TERMINAL]


def apply_edges(steps: List[PlanStep], edges: List[DependencyEdge]) -> None:
    by_id = {s.step_id: s for s in steps}
    for e in edges:
        target = by_id.get(e.to_step)
        if target and e.from_step not in target.depends_on:
            target.depends_on.append(e.from_step)


def detect_cycle(steps: List[PlanStep]) -> List[str]:
    """Returns a cycle if one exists, else []. A plan with a cycle cannot run."""
    colour: Dict[str, int] = {s.step_id: 0 for s in steps}
    by_id = {s.step_id: s for s in steps}
    stack: List[str] = []

    def visit(node: str) -> List[str]:
        colour[node] = 1
        stack.append(node)
        for dep in by_id[node].depends_on:
            if dep not in colour:
                continue
            if colour[dep] == 1:
                return stack[stack.index(dep):] + [dep]
            if colour[dep] == 0:
                found = visit(dep)
                if found:
                    return found
        colour[node] = 2
        stack.pop()
        return []

    for s in steps:
        if colour[s.step_id] == 0:
            found = visit(s.step_id)
            if found:
                return found
    return []


def parallel_groups(steps: List[PlanStep]) -> List[List[str]]:
    """Topological levels. Steps in the same level have no path between them."""
    by_id = {s.step_id: s for s in steps}
    level: Dict[str, int] = {}

    def depth(sid: str, seen: Set[str]) -> int:
        if sid in level:
            return level[sid]
        if sid in seen:
            return 0
        seen.add(sid)
        deps = [d for d in by_id[sid].depends_on if d in by_id]
        level[sid] = 0 if not deps else 1 + max(depth(d, seen) for d in deps)
        return level[sid]

    for s in steps:
        depth(s.step_id, set())

    groups: Dict[int, List[str]] = {}
    for s in steps:
        groups.setdefault(level[s.step_id], []).append(s.step_id)
    return [groups[k] for k in sorted(groups)]


def strategy_for(groups: List[List[str]], step_count: int) -> ExecutionStrategy:
    if step_count <= 1:
        return ExecutionStrategy.SINGLE_STEP
    if any(len(g) > 1 for g in groups):
        return (ExecutionStrategy.PHASED if len(groups) >= 5
                else ExecutionStrategy.PARALLELIZABLE)
    return ExecutionStrategy.SEQUENTIAL
