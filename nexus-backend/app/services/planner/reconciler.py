"""
Reconcile the plan against the Decision Engine's estimate.

The Decision Engine predicts a step count from complexity signals; the Planner
derives one from the actual decomposition. When they disagree the plan must say
why, which is what makes post-plan re-evaluation possible rather than a silent
mismatch nobody notices.
"""

from typing import List, Tuple

from .models import PlanStep

TOLERANCE = 2


def reconcile(estimated: int, steps: List[PlanStep], clause_count: int,
              band: str) -> Tuple[int, str]:
    actual = len(steps)
    deviation = actual - estimated

    if abs(deviation) <= TOLERANCE:
        return deviation, f"Within tolerance of the {estimated}-step estimate"

    if deviation > 0:
        if clause_count > 1:
            return deviation, (
                f"Prompt contains {clause_count} distinct tasks; each was decomposed "
                f"separately, expanding {estimated} estimated steps to {actual}")
        return deviation, (
            f"Decomposition of a {band} task required {actual} concrete operations "
            f"where the estimate predicted {estimated}")

    return deviation, (
        f"Request decomposed into {actual} concrete operations; the {estimated}-step "
        f"estimate over-predicted for this {band} task")
