from fastapi import HTTPException


class RequestValidator:

    @staticmethod
    def validate(prompt: str):

        if prompt is None:
            raise HTTPException(
                status_code=400,
                detail="Prompt is missing"
            )

        prompt = prompt.strip()

        if prompt == "":
            raise HTTPException(
                status_code=400,
                detail="Prompt cannot be empty"
            )

        if len(prompt) < 5:
            raise HTTPException(
                status_code=400,
                detail="Prompt too short"
            )

        if len(prompt) > 10000:
            raise HTTPException(
                status_code=400,
                detail="Prompt too long"
            )

        return True
