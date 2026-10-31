from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.repositories.decision_repository import DecisionRepository, rehydrate
from app.schemas.decision import DecisionRequest, DecisionResponse
from app.services.decision import DecisionService
from app.services.decision.estimates import estimate_cost, estimate_duration
from app.services.decision.explain import build_explanations
from app.services.decision.agents_preview import preview_agents
from app.services.validator.request_validator import RequestValidator
from app.utils.ids import generate_decision_id

router = APIRouter(prefix="/decision", tags=["Decision"])


def to_response(decision_id: str, record) -> DecisionResponse:
    agents, breakdown = preview_agents(record)
    return DecisionResponse(
        decision_id=decision_id,
        intent=record.intent.value,
        intent_label=record.intent_label,
        intent_scores=record.intent_scores,
        domain=record.domain,
        entities=record.entities,
        actions=record.actions,
        confidence=record.confidence,
        confidence_tier=record.confidence_tier.value,
        complexity_score=record.complexity_score,
        complexity_band=record.complexity_band.value,
        complexity_factors=record.complexity_factors,
        estimated_steps=record.estimated_steps,
        execution_mode=record.execution_mode.value,
        mode_source=record.mode_source.value,
        requires_planning=record.requires_planning,
        requires_hitl=record.requires_hitl,
        clarifying_question=record.clarifying_question,
        estimated_duration=estimate_duration(record),
        estimated_cost=estimate_cost(record),
        classifier_tier=record.classifier_tier,
        latency_ms=record.latency_ms,
        reasoning=record.reasoning,
        explanations=build_explanations(record, agents),
        estimated_agents=agents,
        agent_breakdown=breakdown,
    )


@router.post("/", response_model=DecisionResponse, summary="Classify a prompt")
def create_decision(request: DecisionRequest, db: Session = Depends(get_db)):
    """
    The single engine of record. The Intelligence Panel calls this on debounce,
    then passes the returned decision_id to POST /api/mission so the backend
    reuses this classification instead of deriving a second, different one.
    """
    RequestValidator.validate(request.prompt)

    record = DecisionService.decide(request.prompt, mode_override=request.mode_override)

    decision_id = generate_decision_id()
    DecisionRepository.create(db, decision_id, record)

    return to_response(decision_id, record)


@router.get("/{decision_id}", response_model=DecisionResponse, summary="Fetch a stored decision")
def get_decision(decision_id: str, db: Session = Depends(get_db)):
    row = DecisionRepository.get(db, decision_id)
    if not row:
        raise HTTPException(status_code=404, detail=f"Unknown decision: {decision_id}")

    return to_response(row.decision_id, rehydrate(row))
