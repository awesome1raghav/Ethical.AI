from enum import Enum
from pydantic import BaseModel


class SecurityStatus(str, Enum):

    SAFE = "SAFE"

    WARNING = "WARNING"

    BLOCKED = "BLOCKED"


class ThreatLevel(str, Enum):

    LOW = "LOW"

    MEDIUM = "MEDIUM"

    HIGH = "HIGH"


class MatrixResult(BaseModel):

    security_status: SecurityStatus

    threat_level: ThreatLevel

    warnings: list[str]

    blocked_resources: list[str]

    recommended_action: str
