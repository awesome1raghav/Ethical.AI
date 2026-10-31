from enum import Enum


class Capability(str, Enum):

    BROWSER = "Browser"

    WEB_SEARCH = "Web Search"

    SUMMARIZATION = "Summarization"

    CITATION = "Citation"

    REPORT = "Report Generation"

    CODING = "Coding"

    FILE = "File Generation"

    REASONING = "Reasoning"

    CHAT = "Chat"

    MEMORY = "Memory"
