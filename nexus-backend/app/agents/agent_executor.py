"""
Per-step mission execution.

AgentExecutor walks the plan one step at a time:
  - skips steps already in context.step_results, so a resumed mission
    continues where it stopped
  - pauses at the first unapproved step that requires human approval,
    leaving later steps untouched
  - halts the mission with an explicit status and reason when a step has no
    agent implementation or raises; a failed step is never marked completed

`on_step(context)` is called after each step outcome is recorded, letting the
caller persist a checkpoint so clients see live progress.

`is_cancelled()` is checked before each pending step. Cancellation is
cooperative: a step already running (a model call, a browser session) cannot
be interrupted, so cancellation takes effect at the next step boundary.
"""


from .registry import AGENT_REGISTRY
from .step_execution import CapabilityUnavailableError


class AgentExecutor:

    @staticmethod
    def execute(assignments, context, on_step=None, is_cancelled=None):
        plan = getattr(context, "execution_plan", None)
        steps = getattr(plan, "steps", None)

        if steps is None:
            # Legacy plan shape (no typed steps) -- preserve the original
            # whole-context loop so any caller still on that path is unaffected.
            for assignment in assignments:
                agent_key = assignment.agent.value if hasattr(assignment.agent, "value") else str(assignment.agent)
                agent_cls = AGENT_REGISTRY.get(agent_key)
                if not agent_cls:
                    continue
                context = agent_cls().execute(context)
            return context

        completed_ids = {r["step_id"] for r in context.step_results if r["status"] == "completed"}

        for step, assignment in zip(steps, assignments):
            if step.step_id in completed_ids:
                continue

            if is_cancelled and is_cancelled():
                context.status = "cancelled"
                context.status_reason = (
                    f"Cancelled by user before step '{step.action}' started. "
                    f"Steps already completed were not undone."
                )
                context.emit("AgentExecutor", "CANCELLED", context.status_reason)
                if on_step:
                    on_step(context)
                return context

            if step.requires_human_approval and not context.approvals.get(step.step_id):
                context.pending_step_id = step.step_id
                context.status = "awaiting_approval"
                context.status_reason = (
                    f"Step '{step.action}' ({step.operation.value}) requires "
                    f"human approval before it can run"
                )
                context.emit("AgentExecutor", "PENDING_APPROVAL",
                             f"Paused before '{step.action}' -- requires human approval")
                if on_step:
                    on_step(context)
                return context

            agent_key = assignment.agent.value if hasattr(assignment.agent, "value") else str(assignment.agent)
            agent_cls = AGENT_REGISTRY.get(agent_key)

            context.running_step_id = step.step_id
            context.emit(agent_key, "RUNNING", f"Executing: {step.action}")
            if on_step:
                on_step(context)

            if not agent_cls:
                context.running_step_id = None
                context.step_results.append({
                    "step_id": step.step_id, "agent": agent_key,
                    "status": "failed",
                    "error": f"No agent implementation registered for {agent_key}",
                })
                context.emit(agent_key, "FAILED",
                             f"No agent implementation for {agent_key} -- capability unavailable")
                context.status = "failed"
                context.status_reason = (
                    f"Step '{step.action}' requires {agent_key}, which has no "
                    f"implementation registered. The mission cannot silently "
                    f"continue without this capability."
                )
                if on_step:
                    on_step(context)
                return context

            agent = agent_cls()
            try:
                raw = agent.run_step(step, context)
            except CapabilityUnavailableError as exc:
                context.running_step_id = None
                context.step_results.append({
                    "step_id": step.step_id, "agent": agent_key,
                    "status": "failed", "error": str(exc),
                })
                context.emit(agent_key, "FAILED", f"{step.action}: {exc}")
                context.status = "failed"
                context.status_reason = f"Step '{step.action}' unavailable: {exc}"
                if on_step:
                    on_step(context)
                return context
            except Exception as exc:  # noqa: BLE001
                context.running_step_id = None
                context.step_results.append({
                    "step_id": step.step_id, "agent": agent_key,
                    "status": "failed", "error": str(exc),
                })
                context.emit(agent_key, "FAILED", f"{step.action} failed: {exc}")
                context.status = "failed"
                context.status_reason = f"Step '{step.action}' failed: {exc}"
                if on_step:
                    on_step(context)
                return context

            from app.core.execution_context import ExecutionContext
            if isinstance(raw, ExecutionContext):
                # Legacy step-unaware agent (ResearchAgent, AnalysisAgent,
                # ReportAgent) -- it mutated context directly; no distinct
                # per-step output string to record.
                context = raw
                output = None
            else:
                output = raw

            context.running_step_id = None
            context.step_results.append({
                "step_id": step.step_id, "agent": agent_key,
                "status": "completed", "output": output,
            })
            context.emit(agent_key, "SUCCESS", f"Completed: {step.action}")
            if on_step:
                on_step(context)

        context.pending_step_id = None
        return context
