def validate_prompt(prompt: str):

    if prompt is None:
        return False, "Prompt is missing"

    if len(prompt.strip()) == 0:
        return False, "Prompt is empty"

    if len(prompt) < 5:
        return False, "Prompt too short"

    if len(prompt) > 10000:
        return False, "Prompt too long"

    return True, "Validation Passed"