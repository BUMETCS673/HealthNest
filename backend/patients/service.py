from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, status

from auth.client import get_supabase_admin
from auth.deps import require_active_relationship


_SAFE_COLUMNS = "id, first_name, last_name, preferred_name, mrn, date_of_birth"


def _active_patient_ids_for_provider(provider_id: str) -> list[str]:
    now_iso = datetime.now(timezone.utc).isoformat()
    resp = (
        get_supabase_admin()
        .table("patient_provider_relationships")
        .select("patient_id, started_at, ended_at")
        .eq("provider_id", provider_id)
        .lte("started_at", now_iso)
        .execute()
    )
    return [
        r["patient_id"]
        for r in (resp.data or [])
        if r["ended_at"] is None or r["ended_at"] > now_iso
    ]


def _escape_ilike(term: str) -> str:
    """PostgREST `or` filters use `,` and `.` as delimiters — strip them."""
    return term.replace(",", " ").replace(".", " ").replace("%", "").strip()


def search(*, provider_id: str, q: str | None, limit: int) -> list[dict[str, Any]]:
    patient_ids = _active_patient_ids_for_provider(provider_id)
    if not patient_ids:
        return []

    query = (
        get_supabase_admin()
        .table("patients")
        .select(_SAFE_COLUMNS)
        .in_("id", patient_ids)
        .is_("deleted_at", None)
        .order("last_name")
        .order("first_name")
        .limit(limit)
    )

    if q:
        term = _escape_ilike(q)
        if term:
            # OR across first_name, last_name, preferred_name, mrn (case-insensitive).
            query = query.or_(
                f"first_name.ilike.%{term}%,"
                f"last_name.ilike.%{term}%,"
                f"preferred_name.ilike.%{term}%,"
                f"mrn.ilike.%{term}%"
            )

    return query.execute().data or []


def get_one(*, provider_id: str, patient_id: str) -> dict[str, Any]:
    require_active_relationship(provider_id, patient_id)
    resp = (
        get_supabase_admin()
        .table("patients")
        .select(_SAFE_COLUMNS)
        .eq("id", patient_id)
        .is_("deleted_at", None)
        .limit(1)
        .execute()
    )
    rows = resp.data or []
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not found")
    return rows[0]
