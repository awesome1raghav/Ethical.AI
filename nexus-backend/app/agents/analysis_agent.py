"""
AnalysisAgent: synthesizes prior step outputs and gathered research for
SUMMARIZE steps, using Gemma 4 12B with a structured output schema.
"""

from app.services.llm import llm_available, structured_call

from .base_agent import BaseAgent
from .step_execution import CapabilityUnavailableError, StepOutput

SYSTEM = """You are an expert research analyst producing a structured \
synthesis of prior work as one step of a larger, already-planned and \
already-governed mission.

Analyze only the concrete material you are given -- prior step outputs and \
any gathered research documents. Do not invent findings the material does \
not support. If the material is too thin to draw real conclusions from, say \
exactly that in `notes` rather than filling the gap with plausible-sounding \
but fabricated content."""


class AnalysisAgent(BaseAgent):

    name = "AnalysisAgent"

    def run(self, context):
        # Legacy whole-context entry point, kept only because BaseAgent.execute
        # calls it; real work happens in run_step, which is what AgentExecutor
        # actually invokes for every step in the new per-step runtime.
        return context

    def run_step(self, step, context):
        if not llm_available():
            raise CapabilityUnavailableError(
                "AnalysisAgent requires Gemma 4 12B on Ollama, which is not available."
            )

        prior = "\n".join(
            f"- [{r['step_id']}] {r['agent']}: {(r.get('output') or '')[:1500]}"
            for r in context.step_results if r.get("status") == "completed"
        )

        # Legacy agents (ResearchAgent's underlying BrowserAgent call) mutate
        # context.research directly instead of returning a captured string --
        # include it explicitly so a SUMMARIZE step after a research step
        # actually sees what was found, instead of synthesizing from nothing.
        docs = context.research.documents
        docs_text = "\n\n".join(
            f"Title: {getattr(d, 'title', '')}\nURL: {getattr(d, 'url', '')}\n"
            f"Content: {(getattr(d, 'content', '') or '')[:2000]}"
            for d in docs
        ) if docs else ""

        prompt = f"""Mission objective: {context.prompt}

Current step: {step.action}
Description: {step.description}
Purpose: {step.purpose}

Prior completed step outputs:
{prior or '(none yet)'}

Research documents gathered so far:
{docs_text or '(none -- no research step has produced documents yet)'}

Produce the synthesis for THIS step only."""

        result = structured_call(SYSTEM, prompt, StepOutput, effort="medium")
        if result is None:
            raise RuntimeError(
                "The model returned no usable result for this step."
            )

        context.research.analysis = result.output
        return result.output
