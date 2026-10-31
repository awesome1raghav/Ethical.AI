from enum import Enum


class IntentType(str, Enum):

    CHAT = "CHAT"

    RESEARCH = "RESEARCH"

    CODING = "CODING"

    FILE = "FILE"

    AUTOMATION = "AUTOMATION"

    UNKNOWN = "UNKNOWN"


class IntentService:

    @staticmethod
    def detect(prompt: str):

        prompt = prompt.lower()

        if any(word in prompt for word in [
            "research",
            "search",
            "find",
            "compare",
            "paper"
        ]):
            return IntentType.RESEARCH

        if any(word in prompt for word in [
            "code",
            "python",
            "bug",
            "backend",
            "fastapi",
            "react"
        ]):
            return IntentType.CODING

        if any(word in prompt for word in [
            "pdf",
            "excel",
            "report",
            "file"
        ]):
            return IntentType.FILE

        if any(word in prompt for word in [
            "automate",
            "workflow",
            "agent"
        ]):
            return IntentType.AUTOMATION

        return IntentType.CHAT
