from enum import Enum
from pydantic import BaseModel


class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class Decision(str, Enum):
    APPROVED = "APPROVED"
    REVIEW = "REVIEW"
    DENIED = "DENIED"


class HelixResult(BaseModel):
    decision: Decision
    risk: RiskLevel
    reason: str
    human_in_loop: bool
