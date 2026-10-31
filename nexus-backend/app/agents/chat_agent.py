"""
ChatAgent: handles outbound-communication and general chat-classified steps.

SEND_MESSAGE fails explicitly because no delivery integration (SMTP, email
API, messaging provider) is configured; it never reports a message as sent.
Other chat steps are answered by the model, as in ReasoningAgent.
"""

from app.services.llm import llm_available, structured_call
from app.services.planner.models import OperationType

from .base_agent import BaseAgent
from .step_execution import CapabilityUnavailableError, StepOutput

SYSTEM = """You are completing one step of a larger, already-planned and \
already-governed mission. Produce the deliverable for THIS step only."""


class ChatAgent(BaseAgent):

    name = "ChatAgent"

    def run(self, context):
        return context

    def run_step(self, step, context):
        if step.operation == OperationType.SEND_MESSAGE:
            raise CapabilityUnavailableError(
                "SEND_MESSAGE requires a real messaging/email provider, which "
                "is not configured. No message was sent."
            )

        if not llm_available():
            raise CapabilityUnavailableError(
                "ChatAgent requires Gemma 4 12B on Ollama, which is not available."
            )

        prior = "\n".join(
            f"- [{r['step_id']}] {r['agent']}: {(r.get('output') or '')[:400]}"
            for r in context.step_results if r.get("status") == "completed"
        )
        prompt = f"""Mission objective: {context.prompt}

Current step: {step.action}
Description: {step.description}
Purpose: {step.purpose}

Prior completed step outputs:
{prior or '(none yet)'}

Produce the deliverable for THIS step only."""

        result = structured_call(SYSTEM, prompt, StepOutput, effort="low")
        if result is None:
            raise RuntimeError("The model returned no usable result for this step.")
        return result.output
