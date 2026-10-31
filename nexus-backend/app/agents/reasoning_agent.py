"""
ReasoningAgent: executes ANALYZE, DESIGN, COMPARE and VALIDATE steps.

VALIDATE steps return a structured pass/fail verdict. A failed verdict raises
ValidationFailedError so the mission fails instead of completing with a
negative verdict buried in free text.
"""

from app.services.llm import llm_available, structured_call
from app.services.planner.models import OperationType

from .base_agent import BaseAgent
from .step_execution import (CapabilityUnavailableError, StepOutput,
                             ValidationFailedError, ValidationOutput)

SYSTEM = """You are completing one step of a larger, already-planned and \
already-governed mission. The plan, risk assessment and approvals are handled \
elsewhere -- your job is only to produce the deliverable for THIS step.

Be concrete and specific to the step's description and purpose. Do not restate \
the mission; do the work.

If the step asks you to analyze, design, compare, or validate something and you \
lack the actual source material (files, prior research, real data) to do so \
genuinely, say exactly what is missing in `notes` rather than inventing content \
to fill the gap."""

VALIDATE_SYSTEM = """You are validating whether earlier work in a mission is \
actually good enough to deliver. You are the last check before the result \
reaches a human.

Set `passed` to true only if the prior step outputs genuinely satisfy this \
step's stated purpose and validation criterion. If prior steps produced empty, \
missing, placeholder, or clearly inadequate material, set `passed` to false --  \
do not be lenient to avoid failing the mission. A false negative here costs a \
retry; a false positive delivers something broken as if it worked.

`reason` must name specifically what passed or failed and why."""


class ReasoningAgent(BaseAgent):

    name = "ReasoningAgent"

    def run(self, context):
        # Legacy whole-context path; nothing currently calls this directly.
        return context

    def run_step(self, step, context):
        if not llm_available():
            raise CapabilityUnavailableError(
                "ReasoningAgent requires Gemma 4 12B on Ollama, which is not available."
            )

        prior = "\n".join(
            f"- [{r['step_id']}] {r['agent']}: {(r.get('output') or '')[:400]}"
            for r in context.step_results if r.get("status") == "completed"
        )

        if step.operation == OperationType.VALIDATE:
            return self._run_validation(step, context, prior)

        prompt = f"""Mission objective: {context.prompt}

Current step: {step.action}
Operation: {step.operation.value}
Description: {step.description}
Purpose: {step.purpose}
Expected output: {step.expected_output or '(not specified)'}

Prior completed step outputs:
{prior or '(none yet -- this is the first step)'}

Produce the deliverable for THIS step only."""

        result = structured_call(SYSTEM, prompt, StepOutput, effort="medium")
        if result is None:
            raise RuntimeError(
                "The model returned no usable result for this step."
            )
        return result.output

    def _run_validation(self, step, context, prior: str) -> str:
        prompt = f"""Mission objective: {context.prompt}

Validation step: {step.action}
What this validates: {step.description}
Purpose: {step.purpose}
Validation criterion: {step.validation or step.expected_output or '(not specified -- use judgment)'}

Prior completed step outputs to validate:
{prior or '(none -- nothing has produced output yet, which itself should inform your verdict)'}

Determine whether the prior work genuinely satisfies this validation."""

        result = structured_call(VALIDATE_SYSTEM, prompt, ValidationOutput, effort="medium")
        if result is None:
            raise RuntimeError(
                "The model returned no usable result for this validation step."
            )
        if not result.passed:
            raise ValidationFailedError(
                f"{step.action} did not pass: {result.reason or result.output}"
            )
        return result.output
