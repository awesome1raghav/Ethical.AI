"""
HELIX risk assessment.

Risk is the union of the risk surfaces declared by a plan's steps, not its
length: a three-step plan that drops a production table outranks a nine-step
plan that writes source files.
"""


from .models import RiskLevel


def _as_surface(plan):
    """Plan objects carry a risk_summary; legacy step lists carry nothing."""
    return getattr(plan, "risk_summary", None)


class RiskEngine:

    @staticmethod
    def calculate(plan):
        surface = _as_surface(plan)

        if surface is None:
            # Legacy capability-template plan: no declared risk to reason about.
            # Preserved so the pre-rewrite baseline stays reproducible.
            total = len(plan)
            if total <= 5:
                return RiskLevel.LOW
            if total <= 10:
                return RiskLevel.MEDIUM
            return RiskLevel.HIGH

        severity = surface.severity

        if severity >= 4:               # irreversible destruction
            return RiskLevel.HIGH
        if severity == 3:               # destructive or externally visible
            return RiskLevel.HIGH if not surface.reversible else RiskLevel.MEDIUM
        if severity == 2:               # writes, code execution
            return RiskLevel.MEDIUM if surface.credential_access else RiskLevel.LOW
        return RiskLevel.LOW
