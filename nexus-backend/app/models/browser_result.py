from datetime import datetime, timezone
from pydantic import BaseModel, Field


class BrowserResult(BaseModel):

    title: str

    url: str

    content: str

    status: str = "SUCCESS"

    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    source: str = "Playwright/BrowserUse"
