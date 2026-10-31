from enum import Enum


class ExecutionMode(str, Enum):

    CHAT = "CHAT"

    AGENT = "AGENT"


class ExecutionModeRouter:

    @staticmethod
    def select(intent):

        if intent in [

            "RESEARCH",

            "CODING",

            "FILE",

            "AUTOMATION"

        ]:

            return ExecutionMode.AGENT

        return ExecutionMode.CHAT
