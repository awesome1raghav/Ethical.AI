from .policy_engine import PolicyEngine
from .risk_engine import RiskEngine
from .decision_engine import DecisionEngine
from .models import HelixResult


class HelixService:

    @staticmethod
    def evaluate(plan):

        policy_ok, reason = PolicyEngine.evaluate(plan)

        risk = RiskEngine.calculate(plan)

        decision, human = DecisionEngine.decide(
            policy_ok,
            risk
        )

        return HelixResult(
            decision=decision,
            risk=risk,
            reason=reason,
            human_in_loop=human
        )
