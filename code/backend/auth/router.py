from fastapi import APIRouter, Depends, Header, HTTPException, status

from . import service
from .schemas import (
    AuthResponse,
    RefreshRequest,
    SignInRequest,
    SignUpRequest,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _bearer_token(authorization: str | None = Header(default=None)) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token.",
        )
    return authorization.split(" ", 1)[1].strip()


@router.post("/signup", response_model=AuthResponse)
def signup(payload: SignUpRequest) -> AuthResponse:
    return AuthResponse(**service.sign_up(payload))


@router.post("/signin", response_model=AuthResponse)
def signin(payload: SignInRequest) -> AuthResponse:
    return AuthResponse(**service.sign_in(payload))


@router.post("/signout", status_code=status.HTTP_204_NO_CONTENT)
def signout(token: str = Depends(_bearer_token)) -> None:
    service.sign_out(token)


@router.get("/me")
def me(token: str = Depends(_bearer_token)) -> dict:
    return service.get_user(token)


@router.post("/refresh", response_model=AuthResponse)
def refresh(payload: RefreshRequest) -> AuthResponse:
    return AuthResponse(**service.refresh(payload.refresh_token))
