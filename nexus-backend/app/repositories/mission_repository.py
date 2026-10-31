import json

from sqlalchemy.orm import Session

from app.database.models import Mission


class MissionRepository:

    @staticmethod
    def create(db: Session, mission: Mission):
        db.add(mission)
        db.commit()
        db.refresh(mission)
        return mission

    @staticmethod
    def get(db: Session, mission_id: str):
        return (
            db.query(Mission)
            .filter(Mission.mission_id == mission_id)
            .first()
        )

    @staticmethod
    def update_status(db: Session, mission_id: str, status: str, status_reason: str = None):
        mission = MissionRepository.get(db, mission_id)
        if mission is None:
            return None

        mission.status = status
        mission.status_reason = status_reason

        db.commit()
        db.refresh(mission)
        return mission

    @staticmethod
    def save_checkpoint(db: Session, mission_id: str, context) -> None:
        """
        Persist enough of the ExecutionContext to resume this mission from
        exactly where it paused. Stores generated text and plan metadata only,
        never credentials.
        """
        mission = MissionRepository.get(db, mission_id)
        if mission is None:
            return

        checkpoint = {
            "prompt": context.prompt,
            "decision_id": context.decision_id,
            "plan": context.execution_plan.to_dict() if context.execution_plan else None,
            "step_results": context.step_results,
            "approvals": context.approvals,
            "pending_step_id": context.pending_step_id,
            # Saved on every step (not just at pause/completion) by the
            # background execution's on_step hook, so a client polling
            # mid-run can see which step is actively in progress right now
            # rather than only "done" vs "not done yet".
            "running_step_id": getattr(context, "running_step_id", None),
        }
        mission.checkpoint = json.dumps(checkpoint)
        db.commit()

    @staticmethod
    def load_checkpoint(db: Session, mission_id: str) -> dict:
        mission = MissionRepository.get(db, mission_id)
        if mission is None or not mission.checkpoint:
            return None
        return json.loads(mission.checkpoint)

    @staticmethod
    def request_cancel(db: Session, mission_id: str) -> Mission | None:
        mission = MissionRepository.get(db, mission_id)
        if mission is None:
            return None
        mission.cancel_requested = True
        db.commit()
        db.refresh(mission)
        return mission

    @staticmethod
    def is_cancel_requested(db: Session, mission_id: str) -> bool:
        """
        Reads fresh from the DB each call rather than trusting an in-memory
        flag -- the background task and the /cancel request run on different
        threads with their own sessions, so this is the only way the running
        task can actually see a cancellation the user just asked for.
        """
        mission = MissionRepository.get(db, mission_id)
        return bool(mission and mission.cancel_requested)
