"""
HELIX policy evaluation.

Two kinds of human involvement are handled differently:
  * Irreversible, destructive operations (DATABASE_DELETE, DELETE_FILE) block
    the whole mission up front, so nothing runs before a human reviews it.
  * Operations that need approval but are otherwise safe to prepare for
    (SEND_MESSAGE, DEPLOY, CREDENTIAL_ACCESS) are not blocked here.
    AgentExecutor pauses at that exact step, after earlier steps have run,
    and resumes once it is approved.
"""


from app.services.planner.models import OperationType as OT


class PolicyEngine:

    @staticmethod
    def evaluate(plan):
        steps = getattr(plan, "steps", None)

        if steps is None:
            # Legacy plan shape -- retain the original check so baseline runs
            # remain reproducible, while being explicit that it is vestigial.
            for step in plan:
                action = getattr(step, "action", "").lower()
                if "delete" in action:
                    return False, "Dangerous delete operation"
                if "format" in action:
                    return False, "Disk formatting not allowed"
            return True, "Policy Passed"

        irreversible = [s for s in steps
                        if s.risk_surface.destructive and not s.risk_surface.reversible]
        if irreversible:
            names = ", ".join(s.action for s in irreversible)
            return False, (f"Irreversible destructive operation requires approval: {names}")

        return True, "Policy Passed"
