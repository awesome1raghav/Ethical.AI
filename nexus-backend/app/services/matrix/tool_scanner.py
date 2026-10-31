"""
MATRIX tool and operation scanner.

Reads each step's declared operation and tools, so the security surface
reflects what the plan actually performs.
"""


from app.services.planner.models import OperationType as OT

SENSITIVE_OPS = {
    OT.DELETE_FILE: "Irreversible filesystem deletion",
    OT.DATABASE_DELETE: "Irreversible database deletion",
    OT.DATABASE_WRITE: "Database mutation",
    OT.CREDENTIAL_ACCESS: "Credential access",
    OT.DEPLOY: "External deployment with side effects",
    OT.RUN_TESTS: "Local code execution",
    OT.NETWORK_REQUEST: "Outbound network access",
    OT.SEND_MESSAGE: "Outbound message to a third party",
}


class ToolScanner:

    @staticmethod
    def scan(plan):
        steps = getattr(plan, "steps", None)

        if steps is None:
            # Legacy plan shape.
            return ["Filesystem tool requested"
                    for step in plan if "Delete" in getattr(step, "action", "")]

        warnings = []
        for step in steps:
            label = SENSITIVE_OPS.get(step.operation)
            if label:
                warnings.append(f"{label} in step {step.step_id} ({step.action})")
            if step.risk_surface.destructive and not step.risk_surface.reversible:
                warnings.append(f"Irreversible operation: {step.action}")
        return warnings
