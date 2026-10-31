"""
Model-assisted HELIX and MATRIX analysis.

The deterministic engines are precise about what a plan declares (which steps
write, delete, or are irreversible) but blind to what it means: that
"rebuild authentication" after dropping a users table implies credential
loss, or that a scrape step could carry injected instructions. The model
supplies that reading; it never supplies the verdict.

Ratchet rule, enforced in code below: advisory input may escalate risk and add
concerns, but may never de-escalate, clear a concern, or approve something the
deterministic engine denied. `merge_risk` takes the stricter of the two, so a
mistaken or compromised advisory degrades to noise, not to an approval.
"""


import logging
from typing import List, Optional

from pydantic import BaseModel, Field

from app.services.helix.models import Decision, HelixResult, RiskLevel
from app.services.llm import structured_call
from app.services.matrix.models import MatrixResult, SecurityStatus, ThreatLevel

logger = logging.getLogger(__name__)

RISK_ORDER = {RiskLevel.LOW: 0, RiskLevel.MEDIUM: 1, RiskLevel.HIGH: 2}
DECISION_ORDER = {Decision.APPROVED: 0, Decision.REVIEW: 1, Decision.DENIED: 2}
THREAT_ORDER = {ThreatLevel.LOW: 0, ThreatLevel.MEDIUM: 1, ThreatLevel.HIGH: 2}
STATUS_ORDER = {SecurityStatus.SAFE: 0, SecurityStatus.WARNING: 1, SecurityStatus.BLOCKED: 2}

HELIX_SYSTEM = """You are a governance reviewer for an autonomous AI execution \
platform. You assess an execution plan for policy, ethical and operational risk.

You advise; you do not decide. A separate deterministic engine holds the verdict \
and your assessment can only make it stricter, never more permissive.

Judge second-order consequences the plan does not state outright: data loss that \
is not labelled destructive, actions affecting people, compliance exposure, \
combinations of steps that are riskier together than apart.

risk_level must be LOW, MEDIUM or HIGH."""

MATRIX_SYSTEM = """You are a security reviewer for an autonomous AI execution \
platform. You assess an execution plan for security exposure.

You advise; you do not decide. A separate deterministic scanner holds the verdict \
and your assessment can only make it stricter, never more permissive.

Look for: prompt-injection reachable through fetched or read content, credential \
and secret exposure, privilege escalation across steps, untrusted input flowing \
into an executing step, exfiltration paths.

threat_level must be LOW, MEDIUM or HIGH."""


class HelixAdvice(BaseModel):
    risk_level: str = Field(description="LOW, MEDIUM or HIGH")
    concerns: List[str] = Field(default_factory=list)
    requires_human_review: bool = False
    reasoning: str


class MatrixAdvice(BaseModel):
    threat_level: str = Field(description="LOW, MEDIUM or HIGH")
    concerns: List[str] = Field(default_factory=list)
    attack_surface: List[str] = Field(default_factory=list)
    reasoning: str


def _plan_digest(plan, prompt: str) -> str:
    lines = [f"Mission: {prompt}", f"Complexity: {plan.complexity}", "", "Plan:"]
    for s in plan.steps:
        flags = [f for f in s.risk_surface.active]
        if not s.reversible:
            flags.append("IRREVERSIBLE")
        lines.append(
            f"  [{s.step_id}] {s.action} — op={s.operation.value}"
            f"{' — ' + ', '.join(flags) if flags else ''}"
            f"{' — after ' + ','.join(s.depends_on) if s.depends_on else ''}"
        )
    return "\n".join(lines)


def advise_helix(plan, prompt: str, base: HelixResult) -> HelixResult:
    """Merge the model's governance reading into the deterministic verdict."""
    advice = structured_call(HELIX_SYSTEM, _plan_digest(plan, prompt),
                             HelixAdvice, effort="medium")
    if advice is None:
        return base

    try:
        advised_risk = RiskLevel(advice.risk_level.strip().upper())
    except ValueError:
        logger.warning("Discarding unparseable advised risk: %s", advice.risk_level)
        return base

    # Ratchet: strictest wins on every axis.
    risk = max(base.risk, advised_risk, key=lambda r: RISK_ORDER[r])
    decision = base.decision
    if advice.requires_human_review and DECISION_ORDER[decision] < DECISION_ORDER[Decision.REVIEW]:
        decision = Decision.REVIEW

    reason = base.reason
    if advice.concerns:
        reason = f"{base.reason} | Advisory: " + "; ".join(advice.concerns[:3])

    return HelixResult(
        decision=decision,
        risk=risk,
        reason=reason,
        human_in_loop=base.human_in_loop or advice.requires_human_review,
    )


def advise_matrix(plan, prompt: str, base: MatrixResult) -> MatrixResult:
    """Merge the model's security reading into the deterministic verdict."""
    advice = structured_call(MATRIX_SYSTEM, _plan_digest(plan, prompt),
                             MatrixAdvice, effort="medium")
    if advice is None:
        return base

    try:
        advised_threat = ThreatLevel(advice.threat_level.strip().upper())
    except ValueError:
        logger.warning("Discarding unparseable advised threat: %s", advice.threat_level)
        return base

    threat = max(base.threat_level, advised_threat, key=lambda t: THREAT_ORDER[t])

    status = base.security_status
    if advised_threat is ThreatLevel.HIGH and STATUS_ORDER[status] < STATUS_ORDER[SecurityStatus.WARNING]:
        status = SecurityStatus.WARNING

    # recommended_action is never relaxed: a deterministic STOP stays STOP.
    action = base.recommended_action
    if action != "STOP" and advised_threat is ThreatLevel.HIGH:
        action = "REVIEW"

    return MatrixResult(
        security_status=status,
        threat_level=threat,
        warnings=base.warnings + [f"Advisory: {c}" for c in advice.concerns[:3]],
        blocked_resources=base.blocked_resources,
        recommended_action=action,
    )
