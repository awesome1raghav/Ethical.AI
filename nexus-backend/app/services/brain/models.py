from enum import Enum
from pydantic import BaseModel


class ModelProvider(str, Enum):

    OLLAMA = "OLLAMA"


class SelectedModel(BaseModel):

    provider: ModelProvider

    model: str
