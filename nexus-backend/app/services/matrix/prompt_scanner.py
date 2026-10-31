class PromptScanner:

    BLOCKED = [

        "ignore previous instructions",

        "bypass",

        "jailbreak",

        "system prompt"

    ]

    @staticmethod
    def scan(prompt: str):

        warnings = []

        for attack in PromptScanner.BLOCKED:

            if attack in prompt.lower():

                warnings.append(attack)

        return warnings
