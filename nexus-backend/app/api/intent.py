from fastapi import APIRouter

from app.schemas.intent import IntentRequest, IntentResponse
from app.services.intent.intent_service import IntentService
from app.services.validator.request_validator import RequestValidator

router = APIRouter(
    prefix="/intent",
    tags=["Intent"]
)


@router.post(
    "/",
    response_model=IntentResponse,
    summary="Detect intent from prompt"
)
def detect_intent(request: IntentRequest):

    RequestValidator.validate(request.prompt)

    intent = IntentService.detect(request.prompt)

    return IntentResponse(
        intent=intent.value,
        confidence=1.0
    )
