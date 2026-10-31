"""
CodingAgent: executes IMPLEMENT and CONFIGURE steps by writing real files to a
per-mission project directory (workspace/apps/{mission_id}/).

RUN_TESTS and DEPLOY raise CapabilityUnavailableError: no sandboxed test
runner or deployment target is configured, so the agent never reports a test
or deployment result for something it did not run.
"""


from app.services.llm import llm_available, structured_call
from app.services.planner.models import OperationType
from app.tools.workspace import app_dir, read_app_files
from app.tools.workspace import safe_path as _shared_safe_path

from .base_agent import BaseAgent
from .step_execution import CapabilityUnavailableError, CodeFilesOutput

NO_EXECUTION_ENVIRONMENT = {OperationType.RUN_TESTS, OperationType.DEPLOY}

BUILD_SYSTEM = """You are a software engineer completing one step of a larger, \
already-planned and already-governed mission to build a real, runnable \
application. The plan, risk assessment and approvals are handled elsewhere -- \
your job is only to produce the deliverable for THIS step.

Produce a complete set of real, runnable files for what this step asks for. If \
existing project files are shown below, they are the actual current state of \
the project on disk -- edit or extend them coherently and do not contradict or \
restate work already done. Unless the mission objective names a specific \
framework, language or stack, default to plain HTML/CSS/JavaScript with no \
build step, so the result runs immediately by opening the HTML file or serving \
the folder with any static file server.

Return each file as one entry in `files`, with its real relative path (e.g. \
"index.html", "src/app.js", "styles.css") and its complete real content -- \
never a placeholder, a "TODO: implement this" stand-in, or a truncated \
snippet. Only include files this step actually adds or genuinely needs to \
change. Use `notes` for what a human should know: assumptions made, what \
remains for later steps."""


class CodingAgent(BaseAgent):

    name = "CodingAgent"

    def run(self, context):
        # Legacy whole-context path; nothing currently calls this directly.
        return context

    def run_step(self, step, context):
        if step.operation in NO_EXECUTION_ENVIRONMENT:
            raise CapabilityUnavailableError(
                f"{step.operation.value} requires a real execution environment "
                f"(sandboxed test runner / deployment target), which is not "
                f"configured. No result is reported for an operation that did not run."
            )

        if not llm_available():
            raise CapabilityUnavailableError(
                "CodingAgent requires Gemma 4 12B on Ollama, which is not available."
            )

        # Re-read the project each step so later steps build on what earlier
        # steps actually wrote.
        existing = read_app_files(context.mission_id)
        existing_listing = "\n\n".join(
            f"--- {path} ---\n{content}" for path, content in existing.items()
        ) or "(no files written yet -- this is the first implementation step)"

        prior = "\n".join(
            f"- [{r['step_id']}] {r['agent']}: {(r.get('output') or '')[:300]}"
            for r in context.step_results if r.get("status") == "completed"
        )

        prompt = f"""Mission objective: {context.prompt}

Current step: {step.action}
Operation: {step.operation.value}
Description: {step.description}
Purpose: {step.purpose}
Expected output: {step.expected_output or '(not specified)'}

Existing project files (the real current state on disk):
{existing_listing}

Prior completed step summaries:
{prior or '(none yet)'}

Produce the files for THIS step only."""

        # Multi-file output (JSON-escaped file bodies) needs far more room
        # than the default token budget.
        result = structured_call(BUILD_SYSTEM, prompt, CodeFilesOutput,
                                  effort="medium", max_tokens=12000)
        if result is None:
            raise RuntimeError("The model returned no usable result for this step.")
        if not result.files:
            # The model judged that no file changes were needed for this step.
            return (
                f"No file changes were necessary for this step."
                + (f" Notes: {result.notes}" if result.notes else "")
            )

        target_dir = app_dir(context.mission_id)
        written = []
        for f in result.files:
            try:
                path = _shared_safe_path(target_dir, f.path)
            except ValueError as exc:
                raise CapabilityUnavailableError(str(exc))
            is_new = not path.is_file()
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(f.content, encoding="utf-8")
            written.append((f.path, len(f.content.encode("utf-8")), is_new))

        lines = [
            f"- {'created' if is_new else 'updated'} {p} ({n} bytes)"
            for p, n, is_new in written
        ]
        summary = (
            f"Wrote {len(written)} file(s) to apps/{context.mission_id}/:\n"
            + "\n".join(lines)
        )
        if result.notes:
            summary += f"\n\nNotes: {result.notes}"
        return summary
