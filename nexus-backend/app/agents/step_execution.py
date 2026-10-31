"""
Shared per-step execution contract.

CapabilityUnavailableError signals an explicit capability gap: the agent understood the
step but cannot actually perform it (no sandboxed test runner, no messaging
provider configured, etc). This must never be swallowed into a fake success --
callers propagate it as a real "failed" status with the real reason, matching
the "never fake execution progress" rule.
"""

from typing import List

from pydantic import BaseModel


class StepOutput(BaseModel):
    output: str
    notes: str = ""


class CodeFile(BaseModel):
    path: str
    content: str


class CodeFilesOutput(BaseModel):
    """
    Structured result for a real, multi-file build step (CodingAgent).

    Free-text output could only ever describe code, never actually produce a
    runnable project on disk -- a mission "building an app" would complete
    with a document containing code blocks, not an app. `files` is what
    CodingAgent actually writes to a real per-mission workspace directory.
    """
    files: List[CodeFile]
    notes: str = ""


class ValidationOutput(BaseModel):
    """
    Structured result for a VALIDATE step.

    A validation step exists to check whether earlier work actually succeeded.
    Free-text output alone made that check invisible to the mission's status:
    a step could write "FAIL -- do not deliver" in its own report and still be
    recorded "completed," because AgentExecutor only checks whether the call
    raised, never what the call said. `passed` makes that verdict a real,
    machine-readable field the executor can act on.
    """
    passed: bool
    output: str
    reason: str = ""


class CapabilityUnavailableError(RuntimeError):
    """Raised when a step names an operation with no real implementation."""
    pass


class ValidationFailedError(RuntimeError):
    """
    Raised when a VALIDATE step's own structured verdict is a failure.

    Distinct from CapabilityUnavailableError: the validator ran successfully
    and produced a real judgment -- the judgment itself was negative. The
    mission must halt exactly as it would for any other real failure, not
    continue past a step that just said its own prior work is not good enough
    to deliver.
    """
    pass
