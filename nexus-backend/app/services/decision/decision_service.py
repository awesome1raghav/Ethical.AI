"""
Decision Engine -- orchestrates stages 0 through 6.

Replaces app/services/intent/ (20 keywords, first-match-wins, confidence
hardcoded to 1.0) and app/services/runtime/execution_mode_router.py (mode
inferred from intent category alone).
"""

import time

from .complexity import ComplexityScorer
from .confidence import ConfidenceScorer
from .intent_voter import IntentVoter
from .models import DecisionRecord, ExecutionMode, IntentType, ModeSource
from .normalize import normalize
from .router import DecisionRouter
from .signals import ActionExtractor, DomainDetector, EntityExtractor

INTENT_LABELS = {
    IntentType.CHAT: "General Operations",
    IntentType.RESEARCH: "Research & Analysis",
    IntentType.CODING: "Engineering",
    IntentType.FILE: "Document Processing",
    IntentType.AUTOMATION: "Automation & Orchestration",
    IntentType.COMMUNICATION: "Communication & Outreach",
}


class DecisionService:

    @staticmethod
    def decide(prompt: str, mode_override: str = None) -> DecisionRecord:
        started = time.perf_counter()

        p = normalize(prompt)

        scores, evidence = IntentVoter.vote(p)
        intent = max(scores.items(), key=lambda kv: kv[1])[0]
        confidence, tier = ConfidenceScorer.score(scores, evidence)
        c_score, band, factors, steps = ComplexityScorer.score(p)
        destructive = bool(factors.pop("_destructive", 0))
        mode, planning, hitl, question = DecisionRouter.route(
            tier, band, scores, destructive=destructive)

        source = ModeSource.AUTO
        if mode_override:
            requested = mode_override.strip().upper()
            if requested in ExecutionMode.__members__ and requested != mode.value:
                mode = ExecutionMode[requested]
                planning = mode is ExecutionMode.MISSION
                question = ""
                source = ModeSource.USER_OVERRIDE

        record = DecisionRecord(
            prompt=prompt,
            intent=intent,
            intent_label=INTENT_LABELS.get(intent, "General Operations"),
            intent_scores={k.value: round(v, 4) for k, v in sorted(
                scores.items(), key=lambda kv: kv[1], reverse=True)},
            domain=DomainDetector.business_domain(p),
            entities=EntityExtractor.extract(p),
            actions=ActionExtractor.extract(p),
            confidence=confidence,
            confidence_tier=tier,
            complexity_score=c_score,
            complexity_band=band,
            complexity_factors=factors,
            estimated_steps=steps,
            execution_mode=mode,
            mode_source=source,
            requires_planning=planning,
            requires_hitl=hitl,
            clarifying_question=question or None,
            classifier_tier=1,
        )

        record.reasoning = DecisionService._explain(record, p)
        record.latency_ms = int((time.perf_counter() - started) * 1000)
        return record

    @staticmethod
    def _explain(r: DecisionRecord, p) -> list:
        top = list(r.intent_scores.items())[:2]
        lines = [
            f"Intent {r.intent.value} scored {top[0][1]}"
            + (f" against {top[1][0]} at {top[1][1]}" if len(top) > 1 else ""),
            f"Confidence {r.confidence} ({r.confidence_tier.value}) from the margin between them",
            f"Complexity {r.complexity_score} ({r.complexity_band.value}) from "
            + ", ".join(f"{k}={v}" for k, v in r.complexity_factors.items() if v > 0),
            f"Routed to {r.execution_mode.value}"
            + (" with human review" if r.requires_hitl else ""),
        ]
        if p.is_definitional:
            lines.append("Definitional framing detected -- capped below mission threshold")
        if r.requires_hitl and r.execution_mode.value == "MISSION" and r.complexity_band.value in ("TRIVIAL", "SIMPLE", "MODERATE"):
            lines.append("Irreversible operation detected -- forced onto the governed mission path")
        if r.mode_source is ModeSource.USER_OVERRIDE:
            lines.append("Mode set by user override, not by the engine")
        return lines
