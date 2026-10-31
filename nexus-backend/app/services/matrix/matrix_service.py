from .models import MatrixResult, SecurityStatus, ThreatLevel
from .url_scanner import URLScanner
from .tool_scanner import ToolScanner
from .prompt_scanner import PromptScanner
from .model_scanner import ModelScanner
from .network_scanner import NetworkScanner
from .secret_scanner import SecretScanner


class MatrixService:

    @staticmethod
    def prescan(prompt):
        """
        Prompt-level scan that runs BEFORE execution-mode routing.

        evaluate() requires an execution plan, so it can only run on the agent
        path -- which meant a prompt routed to CHAT was never scanned at all.
        Anything derivable from the prompt alone belongs here so that both
        routes are covered and no classifier reads unscanned text.
        """

        blocked = URLScanner.scan(prompt)

        warnings = PromptScanner.scan(prompt)

        if blocked:

            return MatrixResult(
                security_status=SecurityStatus.BLOCKED,
                threat_level=ThreatLevel.HIGH,
                warnings=warnings,
                blocked_resources=blocked,
                recommended_action="STOP"
            )

        if warnings:

            return MatrixResult(
                security_status=SecurityStatus.BLOCKED,
                threat_level=ThreatLevel.HIGH,
                warnings=warnings,
                blocked_resources=[],
                recommended_action="STOP"
            )

        return MatrixResult(
            security_status=SecurityStatus.SAFE,
            threat_level=ThreatLevel.LOW,
            warnings=[],
            blocked_resources=[],
            recommended_action="CONTINUE"
        )


    @staticmethod
    def evaluate(prompt, plan):

        blocked = URLScanner.scan(prompt)

        prompt_warnings = PromptScanner.scan(prompt)

        tool_warnings = ToolScanner.scan(plan)

        model_warnings = ModelScanner.scan(None)

        network_warnings = NetworkScanner.scan()

        secret_warnings = SecretScanner.scan()

        warnings = (
            prompt_warnings
            + tool_warnings
            + model_warnings
            + network_warnings
            + secret_warnings
        )

        if blocked:

            return MatrixResult(
                security_status=SecurityStatus.BLOCKED,
                threat_level=ThreatLevel.HIGH,
                warnings=warnings,
                blocked_resources=blocked,
                recommended_action="STOP"
            )

        if warnings:

            return MatrixResult(
                security_status=SecurityStatus.WARNING,
                threat_level=ThreatLevel.MEDIUM,
                warnings=warnings,
                blocked_resources=[],
                recommended_action="REVIEW"
            )

        return MatrixResult(
            security_status=SecurityStatus.SAFE,
            threat_level=ThreatLevel.LOW,
            warnings=[],
            blocked_resources=[],
            recommended_action="CONTINUE"
        )
