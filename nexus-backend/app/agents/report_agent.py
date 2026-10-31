"""
ReportAgent: produces the final mission report for GENERATE_ARTIFACT steps by
synthesizing prior step outputs and gathered research with Gemma 4 12B.
"""

from app.services.llm import llm_available, structured_call

from .base_agent import BaseAgent
from .step_execution import CapabilityUnavailableError, StepOutput

SYSTEM = """You are producing the final deliverable report for a mission, as \
the last content-generating step of an already-planned and already-governed \
pipeline. Synthesize the real prior work you are given into a coherent \
report that actually answers the mission's objective.

Do not invent facts, findings, or sources the prior work does not contain. \
If the prior work is empty, missing, or does not actually address the \
mission's objective, say exactly that in `notes` and produce as honest and \
minimal a report as the material supports -- never fabricate content to make \
the report look complete."""


class ReportAgent(BaseAgent):

    name = "ReportAgent"

    def run(self, context):
        # Legacy whole-context entry point, kept only because BaseAgent.execute
        # calls it; real work happens in run_step.
        return context

    def run_step(self, step, context):
        if not llm_available():
            raise CapabilityUnavailableError(
                "ReportAgent requires Gemma 4 12B on Ollama, which is not available."
            )

        # Real per-step outputs (ReasoningAgent, FileAgent, CodingAgent, ...).
        prior = "\n".join(
            f"- [{r['step_id']}] {r['agent']}: {r.get('output') or '(no output)'}"
            for r in context.step_results if r.get("status") == "completed"
        )

        # Legacy agents (ResearchAgent) mutate context.research directly
        # instead of returning a captured string -- include that real data
        # too, or a research mission's report would always look empty even
        # when research actually ran.
        docs = context.research.documents
        sources = sorted({getattr(d, "url", "") for d in docs if getattr(d, "url", "")}) if docs else []
        docs_text = "\n\n".join(
            f"Title: {getattr(d, 'title', '')}\nURL: {getattr(d, 'url', '')}\n"
            f"Content: {(getattr(d, 'content', '') or '')[:2000]}"
            for d in docs
        ) if docs else ""
        analysis_text = context.research.analysis or ""

        prompt = f"""Mission objective: {context.prompt}

Report step: {step.action}
Description: {step.description}
Purpose: {step.purpose}

Prior completed step outputs:
{prior or '(none -- nothing has produced output yet, which itself should inform the report)'}

Research documents gathered:
{docs_text or '(none)'}

Prior analysis/synthesis:
{analysis_text or '(none)'}

Produce the final mission report as Markdown."""

        result = structured_call(SYSTEM, prompt, StepOutput, effort="high")
        if result is None:
            raise RuntimeError(
                "The model returned no usable result for this report."
            )

        context.research.sources = sources
        context.research.report = result.output
        context.response = result.output
        return result.output
