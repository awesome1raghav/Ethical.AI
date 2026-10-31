from app.services.intent.intent_service import IntentType
from app.schemas.capability import Capability


class CapabilityService:

    @staticmethod
    def detect(intent: IntentType):

        if intent == IntentType.RESEARCH:

            return [
                Capability.BROWSER,
                Capability.WEB_SEARCH,
                Capability.SUMMARIZATION,
                Capability.CITATION,
                Capability.REPORT,
            ]

        elif intent == IntentType.CODING:

            return [
                Capability.CODING,
                Capability.FILE,
                Capability.REASONING,
            ]

        elif intent == IntentType.FILE:

            return [
                Capability.FILE,
                Capability.SUMMARIZATION,
            ]

        elif intent == IntentType.AUTOMATION:

            return [
                Capability.BROWSER,
                Capability.REASONING,
            ]

        elif getattr(intent, "value", intent) == "COMMUNICATION":

            return [
                Capability.REASONING,
                Capability.REPORT,
                Capability.CHAT,
            ]

        return [
            Capability.CHAT,
            Capability.MEMORY,
        ]
