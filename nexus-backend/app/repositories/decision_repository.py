import json
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.database.models import DecisionRow
from app.services.decision.models import DecisionRecord


class DecisionRepository:

    @staticmethod
    def create(db: Session, decision_id: str, record: DecisionRecord,
               mission_id: str = None, trace_id: str = None) -> DecisionRow:

        row = DecisionRow(
            decision_id=decision_id,
            mission_id=mission_id,
            trace_id=trace_id,
            prompt=record.prompt,
            intent=record.intent.value,
            intent_label=record.intent_label,
            domain=record.domain,
            confidence=record.confidence,
            confidence_tier=record.confidence_tier.value,
            complexity_score=record.complexity_score,
            complexity_band=record.complexity_band.value,
            execution_mode=record.execution_mode.value,
            mode_source=record.mode_source.value,
            requires_planning=record.requires_planning,
            requires_hitl=record.requires_hitl,
            clarifying_question=record.clarifying_question,
            classifier_tier=record.classifier_tier,
            latency_ms=record.latency_ms,
            payload=json.dumps(record.to_dict()),
            created_at=datetime.now(timezone.utc).isoformat(),
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return row

    @staticmethod
    def get(db: Session, decision_id: str) -> DecisionRow:
        return db.query(DecisionRow).filter(
            DecisionRow.decision_id == decision_id
        ).first()

    @staticmethod
    def attach_mission(db: Session, decision_id: str, mission_id: str, trace_id: str):
        row = DecisionRepository.get(db, decision_id)
        if row:
            row.mission_id = mission_id
            row.trace_id = trace_id
            db.commit()
        return row


def rehydrate(row) -> DecisionRecord:
    """Rebuild a DecisionRecord from its stored JSON payload."""
    from app.services.decision.models import (ComplexityBand, ConfidenceTier,
                                              ExecutionMode, IntentType, ModeSource)

    d = json.loads(row.payload)
    return DecisionRecord(
        prompt=d["prompt"],
        intent=IntentType(d["intent"]),
        intent_label=d["intent_label"],
        intent_scores=d["intent_scores"],
        domain=d["domain"],
        entities=d["entities"],
        actions=d["actions"],
        confidence=d["confidence"],
        confidence_tier=ConfidenceTier(d["confidence_tier"]),
        complexity_score=d["complexity_score"],
        complexity_band=ComplexityBand(d["complexity_band"]),
        complexity_factors=d["complexity_factors"],
        estimated_steps=d["estimated_steps"],
        execution_mode=ExecutionMode(d["execution_mode"]),
        mode_source=ModeSource(d["mode_source"]),
        requires_planning=d["requires_planning"],
        requires_hitl=d["requires_hitl"],
        clarifying_question=d["clarifying_question"],
        classifier_tier=d["classifier_tier"],
        latency_ms=d["latency_ms"],
        reasoning=d["reasoning"],
    )
