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
