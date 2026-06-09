"""
AI-USAGE SUMMARY
Tools: Opus 4.7
Overall AI Contribution: ~55%
AI-Assisted Areas: Scaffolded the FastAPI dependency wiring (bearer-token parsing, gotrue user lookup, supabase-admin query chains for the providers/patients/relationships tables).
Human Contributions: Authorization model and role gating, active-relationship time-window semantics, 401 vs 403 mapping, and the decision to enforce care-team checks in Python in parallel with the RLS layer.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import Depends, Header, HTTPException, status

from .client import get_supabase, get_supabase_admin


def bearer_token(authorization: str | None = Header(default=None)) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token.",
        )
    return authorization.split(" ", 1)[1].strip()


def current_user(token: str = Depends(bearer_token)) -> dict[str, Any]:
    try:
        result = get_supabase().auth.get_user(token)
    except Exception as exc:  # gotrue.errors.AuthApiError + transport errors
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token."
        ) from exc

    user = result.user
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token."
        )
    return user.model_dump(mode="json") if hasattr(user, "model_dump") else dict(user)


def current_provider(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    admin = get_supabase_admin()
    resp = (
        admin.table("providers")
        .select("id, user_id, status, deleted_at")
        .eq("user_id", user["id"])
        .is_("deleted_at", None)
        .limit(1)
        .execute()
    )
    rows = resp.data or []
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Caller is not a provider.",
        )
    return rows[0]


def current_patient(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    admin = get_supabase_admin()
    resp = (
        admin.table("patients")
        .select("id, user_id, deleted_at")
        .eq("user_id", user["id"])
        .is_("deleted_at", None)
        .limit(1)
        .execute()
    )
    rows = resp.data or []
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Caller is not a patient.",
        )
    return rows[0]


def current_patient_id(patient: dict[str, Any] = Depends(current_patient)) -> str:
    return patient["id"]


def provider_has_active_relationship(provider_id: str, patient_id: str) -> bool:
    now_iso = datetime.now(timezone.utc).isoformat()
    admin = get_supabase_admin()
    resp = (
        admin.table("patient_provider_relationships")
        .select("id, ended_at, started_at")
        .eq("provider_id", provider_id)
        .eq("patient_id", patient_id)
        .lte("started_at", now_iso)
        .execute()
    )
    for row in resp.data or []:
        if row["ended_at"] is None or row["ended_at"] > now_iso:
            return True
    return False


def require_active_relationship(provider_id: str, patient_id: str) -> None:
    if not provider_has_active_relationship(provider_id, patient_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No active care-team relationship with this patient.",
        )
