from sqlalchemy.orm import Session

from app.database.models import Mission
from app.repositories.mission_repository import MissionRepository
from app.services.validator.request_validator import RequestValidator
from app.utils.ids import generate_mission_id, generate_trace_id


def create_mission(db: Session, prompt: str):

    RequestValidator.validate(prompt)

    mission = Mission(
        mission_id=generate_mission_id(),
        trace_id=generate_trace_id(),
        prompt=prompt,
        status="accepted"
    )

    return MissionRepository.create(db, mission)
