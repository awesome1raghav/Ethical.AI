from sqlalchemy import Boolean, Column, Integer, String, Text

from app.database.database import Base


class Mission(Base):

    __tablename__ = "missions"

    mission_id = Column(String, primary_key=True, index=True)

    trace_id = Column(String)

    prompt = Column(String)

    status = Column(String)

    status_reason = Column(String, nullable=True)

    # Serialized ExecutionContext needed to resume a paused mission:
    # decision_id, plan, step_results, approvals, pending_step_id.
    # Contains generated text and plan metadata only, never credentials.
    checkpoint = Column(Text, nullable=True)

    # Set by POST /api/mission/{id}/cancel; checked by AgentExecutor between
    # steps, so cancellation takes effect at the next step boundary.
    cancel_requested = Column(Boolean, default=False)

class DecisionRow(Base):
    """
    Persisted DecisionRecord.

    Two jobs: it lets POST /api/mission reuse a decision the client already
    obtained (instead of re-deriving intent from scratch), and it is the first
    real audit trail for the routing stage -- every classification is now
    recoverable with the scores and reasoning that produced it.
    """

    __tablename__ = "decisions"

    decision_id = Column(String, primary_key=True, index=True)

    mission_id = Column(String, index=True, nullable=True)
    trace_id = Column(String, nullable=True)

    prompt = Column(String)

    intent = Column(String)
    intent_label = Column(String)
    domain = Column(String)

    confidence = Column(Integer)
    confidence_tier = Column(String)

    complexity_score = Column(Integer)
    complexity_band = Column(String)

    execution_mode = Column(String)
    mode_source = Column(String)
    requires_planning = Column(Boolean, default=False)
    requires_hitl = Column(Boolean, default=False)
    clarifying_question = Column(String, nullable=True)

    classifier_tier = Column(Integer)
    latency_ms = Column(Integer)

    # Full record as JSON: scores, factors, entities, actions, reasoning.
    payload = Column(Text)

    created_at = Column(String)
