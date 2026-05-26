# AI-USAGE SUMMARY 
# Tools: Claude Code
# Overall AI Contribution: ~40% 
# AI-Assisted Areas: Setting up authentication dependencies, including extracting bearer token and getting current user ID.
# Human Contributions: Implementing the logic to extract the token and retrieve user information, ensuring it fits with our authentication system.
# Notes: AI was used to help quickly set up the basic structure of our authentication dependencies.



from fastapi import Depends, Header, HTTPException, status

from auth.service import get_user


def bearer_token(authorization: str | None = Header(default=None)) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token.",
        )
    return authorization.split(" ", 1)[1].strip()


def current_user_id(token: str = Depends(bearer_token)) -> str:
    user = get_user(token)
    return user["id"]
