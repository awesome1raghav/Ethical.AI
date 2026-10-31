import os

from app.core.execution_context import ExecutionContext

from app.services.validator.request_validator import RequestValidator
from app.services.decision import DecisionService
from app.services.decision.models import DecisionRecord, ExecutionMode
from app.services.capability.capability_service import CapabilityService
from app.services.planner.planner_service import PlannerService, PlannerInput
from app.services.agent_registry.agent_factory import AgentFactory
from app.agents.agent_executor import AgentExecutor
from app.services.helix.helix_service import HelixService
from app.services.helix.models import Decision
from app.services.matrix.matrix_service import MatrixService
from app.services.llm import MODEL, llm_available, structured_call
from app.agents.step_execution import StepOutput
from app.services.helix_guardrails import check_input_sync

GUARDRAILS_REQUIRED = os.getenv("HELIX_GUARDRAILS_REQUIRED", "false").lower() in ("1", "true", "yes")

CHAT_SYSTEM = """You are EthicalAI's conversational assistant, answering a \
request the Decision Engine classified as a direct chat/informational \
response rather than a multi-step mission. Answer the request directly and \
concretely. Use `notes` only for caveats about what you could not address."""


class ExecutionRuntime:

    @staticmethod
    def _passes_guardrails(context: ExecutionContext) -> bool:
        """
        Run the prompt through the NeMo Guardrails input rail.

        Returns False (and marks the mission blocked) when a rail blocks it.
        If the guardrails service itself is unavailable the mission continues
        on the deterministic HELIX/MATRIX checks, unless
        HELIX_GUARDRAILS_REQUIRED=true, in which case it fails closed.
        """
        context.emit("HELIX Guardrails", "RUNNING", "Checking prompt against NeMo Guardrails input rail")
        try:
            verdict = check_input_sync(context.prompt)
        except Exception as exc:  # noqa: BLE001 - any engine failure is handled by policy below
            if GUARDRAILS_REQUIRED:
                context.status = "blocked"
                context.status_reason = f"HELIX guardrails unavailable: {exc}"
                context.response = "Blocked: guardrails unavailable"
                context.emit("HELIX Guardrails", "BLOCKED", context.status_reason)
                return False
            context.emit("HELIX Guardrails", "WARNING",
                         f"Guardrails unavailable ({exc}); continuing with deterministic checks")
            return True

        if not verdict["allowed"]:
            context.status = "blocked"
            context.status_reason = f"HELIX guardrails blocked the prompt ({verdict['rail']})"
            context.response = verdict.get("message") or "Blocked by HELIX guardrails"
            context.emit("HELIX Guardrails", "BLOCKED", context.status_reason)
            return False

        context.emit("HELIX Guardrails", "SUCCESS", f"Prompt allowed ({verdict['latency_ms']} ms)")
        return True

    @staticmethod
    def execute(context: ExecutionContext, on_step=None, is_cancelled=None):
        """
        Run a mission through validation, routing, governance and execution.

        Args:
            context: Mission state; mutated in place and returned.
            on_step: Called after each plan step resolves, so callers can
                persist incremental progress.
            is_cancelled: Checked before each pending step for cooperative
                cancellation.
        """

        # 1 Validation
        context.emit("Validator", "RUNNING", "Validating request prompt")
        RequestValidator.validate(context.prompt)
        context.validation_passed = True
        context.emit("Validator", "SUCCESS", "Validation passed")

        # 2 MATRIX pre-scan
        # Runs before routing so the CHAT path is covered too, and so no
        # classifier reads text that has not been security-scanned.
        context.emit("MATRIX", "RUNNING", "Pre-scanning prompt before routing")
        prescan = MatrixService.prescan(context.prompt)
        context.matrix_result = prescan

        if prescan.recommended_action == "STOP":
            detail = ", ".join(prescan.warnings + prescan.blocked_resources)
            context.emit("MATRIX", "BLOCKED", f"Prompt blocked pre-routing: {detail}")
            context.status = "blocked"
            context.status_reason = f"MATRIX pre-scan: {detail}"
            context.response = "Blocked by MATRIX"
            return context

        context.emit("MATRIX", "SUCCESS", "Pre-scan passed")

        # 2b HELIX guardrails (NVIDIA NeMo Guardrails input rail on Gemma)
        if not ExecutionRuntime._passes_guardrails(context):
            return context

        # 3 Decision -- intent, confidence and complexity in one pass.
        # Reuses the record the client already obtained where one was supplied,
        # so a mission is classified exactly once end to end.
        if context.decision is not None:
            context.emit("Decision", "SUCCESS",
                         f"Reusing decision {context.decision_id}: "
                         f"{context.decision.intent.value} / "
                         f"{context.decision.execution_mode.value}")
        else:
            context.emit("Decision", "RUNNING", "Classifying intent, confidence and complexity")
            context.decision = DecisionService.decide(context.prompt)
            context.emit("Decision", "SUCCESS",
                         f"{context.decision.intent.value} "
                         f"(confidence {context.decision.confidence}, "
                         f"complexity {context.decision.complexity_band.value}) "
                         f"-> {context.decision.execution_mode.value}")

        decision: DecisionRecord = context.decision
        context.intent = decision.intent
        context.execution_mode = decision.execution_mode

        # Too ambiguous to act on -- ask rather than guess.
        if decision.execution_mode == ExecutionMode.CLARIFY:
            context.emit("Decision", "NEEDS_INPUT", decision.clarifying_question or "Clarification required")
            context.status = "needs_clarification"
            context.status_reason = decision.clarifying_question or "Ambiguous request"
            context.response = decision.clarifying_question
            return context

        # Chat Runtime
        if context.execution_mode == ExecutionMode.CHAT:

            context.emit("Gemma", "RUNNING", "Generating conversational response")

            if not llm_available():
                context.status = "failed"
                context.status_reason = f"Chat response requires {MODEL} on Ollama, which is not reachable."
                context.emit("Gemma", "FAILED", context.status_reason)
                context.response = context.status_reason
                return context

            result = structured_call(CHAT_SYSTEM, context.prompt, StepOutput, effort="medium")
            if result is None:
                context.status = "failed"
                context.status_reason = "The model returned no usable result for this chat response."
                context.emit("Gemma", "FAILED", context.status_reason)
                context.response = context.status_reason
                return context

            context.ai_response = result.output
            context.emit("Gemma", "SUCCESS", "Chat response generated")

            context.response = result.output
            context.status = "completed"
            return context

        # Agent Runtime
        if decision.requires_hitl:
            context.emit("Decision", "PENDING_APPROVAL",
                         f"Complexity {decision.complexity_band.value} at "
                         f"{decision.confidence_tier.value} confidence requires review")
            context.status = "awaiting_approval"
            context.status_reason = (
                f"Decision Engine: {decision.complexity_band.value} work at "
                f"{decision.confidence_tier.value} confidence requires human approval"
            )
            context.response = "Awaiting human approval"
            return context

        context.emit("Capability", "RUNNING", "Detecting capabilities")
        context.capabilities = CapabilityService.detect(
            context.intent
        )
        context.emit("Capability", "SUCCESS", f"Detected {len(context.capabilities)} capabilities")

        context.emit("Planner", "RUNNING", "Planning the mission")
        context.execution_plan = PlannerService.generate_plan(PlannerInput(
            prompt=context.prompt,
            decision_record=decision,
            mission_id=context.mission_id,
            available_capabilities=context.capabilities,
        ))
        # Tier 2: the model proposes steps the templates missed. Additive only,
        # and every added step's risk is re-derived from the registry.
        from app.services.planner.llm_planner import enrich as llm_enrich
        context.execution_plan = llm_enrich(context.execution_plan, context.prompt)

        _plan = context.execution_plan
        context.emit(
            "Planner", "SUCCESS",
            f"{_plan.actual_steps} steps ({_plan.execution_strategy.value}), "
            f"estimate {_plan.estimated_steps} ({_plan.deviation:+d}): {_plan.deviation_reason}")

        if _plan.actual_steps == 0:
            context.emit("Planner", "NEEDS_INPUT", "No actionable task found in the request")
            context.status = "needs_clarification"
            context.status_reason = "Planner could not derive any actionable step"
            context.response = "The request does not describe an actionable task."
            return context

        context.emit("HELIX", "RUNNING", "Evaluating governance policy and risk")
        context.helix_result = HelixService.evaluate(
            context.execution_plan
        )
        # Advisory can raise risk or demand review; it can never clear either.
        from app.services.advisors import advise_helix
        context.helix_result = advise_helix(
            context.execution_plan, context.prompt, context.helix_result)
        context.emit(
            "HELIX", "SUCCESS",
            f"decision={context.helix_result.decision.value} "
            f"risk={context.helix_result.risk.value} -- {context.helix_result.reason}")

        if context.helix_result.decision == Decision.DENIED:
            context.emit("HELIX", "DENIED", f"Governance denied execution: {context.helix_result.reason}")
            context.status = "blocked"
            context.status_reason = f"HELIX denied: {context.helix_result.reason}"
            context.response = "Blocked by HELIX"
            return context

        if context.helix_result.human_in_loop:
            context.emit("HELIX", "PENDING_APPROVAL", f"Human approval required: {context.helix_result.reason}")
            context.status = "awaiting_approval"
            context.status_reason = f"HELIX requires human approval: {context.helix_result.reason}"
            context.response = "Awaiting human approval"
            return context

        context.emit("MATRIX", "RUNNING", "Scanning security and prompt safety")
        context.matrix_result = MatrixService.evaluate(
            context.prompt,
            context.execution_plan
        )
        from app.services.advisors import advise_matrix
        context.matrix_result = advise_matrix(
            context.execution_plan, context.prompt, context.matrix_result)
        context.emit("MATRIX", "SUCCESS", f"MATRIX status: {context.matrix_result.security_status}")

        if context.matrix_result.recommended_action == "STOP":
            detail = ", ".join(
                context.matrix_result.warnings + context.matrix_result.blocked_resources
            )
            context.emit("MATRIX", "BLOCKED", f"Security blocked execution: {detail}")
            context.status = "blocked"
            context.status_reason = f"MATRIX blocked: {detail}"
            context.response = "Blocked by MATRIX"
            return context

        context.emit("AgentRegistry", "RUNNING", "Assigning agents to plan steps")
        context.assigned_agents = AgentFactory.assign(
            context.execution_plan
        )
        context.emit(
            "AgentRegistry", "SUCCESS",
            f"Assigned {len(context.assigned_agents)} agents: "
            + ", ".join(sorted({a.agent.value for a in context.assigned_agents})))

        # Each step below runs its own model call (or a deterministic
        # operation); there is no mission-wide model selection.
        context.emit("AgentExecutor", "RUNNING", "Executing assigned worker agents")
        context = AgentExecutor.execute(context.assigned_agents, context, on_step=on_step, is_cancelled=is_cancelled)

        # Preserve terminal states set by AgentExecutor; only a clean run
        # is marked completed.
        if context.status in ("awaiting_approval", "failed", "cancelled"):
            return context

        context.emit("AgentExecutor", "SUCCESS", "All worker agents finished execution")
        context.status = "completed"

        return context
