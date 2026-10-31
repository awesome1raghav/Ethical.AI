class URLScanner:

    BLOCKLIST = [

        "malware",

        "phishing",

        "evil",

        "virus"

    ]

    @staticmethod
    def scan(prompt: str):

        blocked = []

        for word in URLScanner.BLOCKLIST:

            if word in prompt.lower():

                blocked.append(word)

        return blocked
