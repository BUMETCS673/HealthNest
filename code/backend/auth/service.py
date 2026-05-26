from typing import Any

from fastapi import HTTPException, status
from gotrue.errors import AuthApiError

from .client import get_supabase
from .schemas import SignInRequest, SignUpRequest


def _serialize_user(user: Any) -> dict[str, Any] | None:
    if user is None:
        return None
    if hasattr(user, "model_dump"):
        return user.model_dump(mode="json")
    if hasattr(user, "dict"):
        return user.dict()
    return dict(user)


def _serialize_session(session: Any) -> dict[str, Any] | None:
    if session is None:
        return None
    data = (
        session.model_dump(mode="json")
        if hasattr(session, "model_dump")
        else dict(session)
    )
    user = data.get("user")
    if user is not None and not isinstance(user, dict):
        data["user"] = _serialize_user(user)
    return data


def sign_up(payload: SignUpRequest) -> dict[str, Any]:
    metadata: dict[str, Any] = {
        "role": payload.role,
        "first_name": payload.first_name.strip(),
        "last_name": payload.last_name.strip(),
    }
    if payload.role == "patient":
        metadata["date_of_birth"] = payload.date_of_birth
        metadata["sex_at_birth"] = payload.sex_at_birth
        metadata["mrn"] = (payload.mrn or "").strip()

    try:
        result = get_supabase().auth.sign_up(
            {
                "email": payload.email,
                "password": payload.password,
                "options": {"data": metadata},
            }
        )
    except AuthApiError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc

    session = _serialize_session(result.session)
    user = _serialize_user(result.user)
    message = (
        None
        if session
        else "Account created. Check your email to confirm before signing in."
    )
    return {"session": session, "user": user, "message": message}


def sign_in(payload: SignInRequest) -> dict[str, Any]:
    try:
        result = get_supabase().auth.sign_in_with_password(
            {"email": payload.email, "password": payload.password}
        )
    except AuthApiError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)
        ) from exc

    session = _serialize_session(result.session)
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials.",
        )
    return {"session": session, "user": _serialize_user(result.user)}


def sign_out(access_token: str) -> None:
    client = get_supabase()
    try:
        client.auth.admin.sign_out(access_token)
    except AttributeError:
        try:
            client.auth.sign_out()
        except AuthApiError:
            pass
    except AuthApiError:
        pass


def get_user(access_token: str) -> dict[str, Any]:
    try:
        result = get_supabase().auth.get_user(access_token)
    except AuthApiError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)
        ) from exc

    user = _serialize_user(result.user)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token."
        )
    return user


def refresh(refresh_token: str) -> dict[str, Any]:
    try:
        result = get_supabase().auth.refresh_session(refresh_token)
    except AuthApiError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)
        ) from exc

    session = _serialize_session(result.session)
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unable to refresh session.",
        )
    return {"session": session, "user": _serialize_user(result.user)}
