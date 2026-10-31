from .models import Decision, RiskLevel


class DecisionEngine:

    @staticmethod
    def decide(policy_ok, risk):

        if not policy_ok:
            return Decision.DENIED, True

        if risk == RiskLevel.HIGH or getattr(risk, "name", "") == "HIGH":
            return Decision.REVIEW, True

        return Decision.APPROVED, False
