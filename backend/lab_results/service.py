"""
AI-USAGE SUMMARY 
Tools: Opus 4.7 
Overall AI Contribution: ~30% 
AI-Assisted Areas: Filled in repeatable patterns for CRUD operations, status transitions, and data transformations
Human Contributions: Business logic, validation, error handling, security checks 
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, status
from postgrest.exceptions import APIError

from auth.client import get_supabase_admin
from auth.deps import require_active_relationship

from . import crypto, storage
from .parsers import ParsedLabResult, ParserError, parse as parse_content
from .schemas import LabResultPatch


logger = logging.getLogger(__name__)

LR_TABLE = "lab_results"
ENTRY_TABLE = "lab_result_entries"


def _translate_pg_error(exc: APIError) -> HTTPException:
    """Map common Postgres-side rejections to clean HTTP errors so the UI can render them."""
    code = getattr(exc, "code", None) or (
        getattr(exc, "args", [None])[0].get("code")
        if exc.args and isinstance(exc.args[0], dict)
        else None
    )
    logger.exception("Postgres rejected a lab result operation")
    if code == "23514":  # check_violation — most often our state-machine trigger
        return HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The requested lab result state change is not allowed.",
        )
    if code == "23502":  # not_null_violation — e.g. released_by required
        return HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Required lab result data is missing.",
        )
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Unable to complete the lab result request.",
    )



def upload(
    *,
    actor_user_id: str,
    provider_id: str,
    patient_id: str,
    source_format: str,
    filename: str,
    content: bytes,
    diagnostic_order_id: str | None,
) -> dict[str, Any]:
    require_active_relationship(provider_id, patient_id)

    try:
        parsed = parse_content(source_format, content)
    except ParserError as exc:
        logger.exception("Unable to parse uploaded lab result")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Unable to parse the uploaded lab result.",
        ) from exc

    lab_result_id = str(uuid.uuid4())
    safe_name = _safe_filename(filename)
    storage_path = f"{lab_result_id}/{safe_name}"
    row = _insert_lab_result(
        lab_result_id=lab_result_id,
        actor_user_id=actor_user_id,
        provider_id=provider_id,
        patient_id=patient_id,
        source_format=source_format,
        storage_path=storage_path,
        diagnostic_order_id=diagnostic_order_id,
        parsed=parsed,
    )
    try:
        _insert_entries(lab_result_id, parsed)
        storage.upload(path=storage_path, content=content, filename=safe_name)
    except Exception:
        _soft_delete_lab_result(lab_result_id)
        raise

    return _to_detail(row, _fetch_entries(lab_result_id), for_patient=False)


def _insert_lab_result(
    *,
    lab_result_id: str,
    actor_user_id: str,
    provider_id: str,
    patient_id: str,
    source_format: str,
    storage_path: str,
    diagnostic_order_id: str | None,
    parsed: ParsedLabResult,
) -> dict[str, Any]:
    notes_enc = crypto.encrypt(
        parsed.notes,
        aad=crypto.aad_for(LR_TABLE, lab_result_id, "notes"),
    )

    payload: dict[str, Any] = {
        "id": lab_result_id,
        "patient_id": patient_id,
        "provider_id": provider_id,
        "storage_path": storage_path,
        "diagnostic_order_id": diagnostic_order_id,
        "source_format": source_format,
        "status": "uploaded",
        "lab_name": parsed.lab_name,
        "ordering_provider_name": parsed.ordering_provider_name,
        "collected_at": _iso(parsed.collected_at),
        "resulted_at": _iso(parsed.resulted_at),
        "parser_version": parsed.parser_version,
        "parse_error": parsed.parse_error,
        "notes_enc": _to_pg_bytea(notes_enc),
        "created_by": actor_user_id,
        "updated_by": actor_user_id,
    }
    resp = get_supabase_admin().table(LR_TABLE).insert(payload).execute()
    return (resp.data or [None])[0]


def _insert_entries(lab_result_id: str, parsed: ParsedLabResult) -> None:
    if not parsed.entries:
        return
    rows: list[dict[str, Any]] = []
    for entry in parsed.entries:
        entry_id = str(uuid.uuid4())
        value_enc = crypto.encrypt(
            entry.value_text,
            aad=crypto.aad_for(ENTRY_TABLE, entry_id, "value"),
        )
        rows.append(
            {
                "id": entry_id,
                "lab_result_id": lab_result_id,
                "loinc_code": entry.loinc_code,
                "component_name": entry.component_name,
                "value_enc": _to_pg_bytea(value_enc),
                "value_numeric": entry.value_numeric,
                "unit": entry.unit,
                "reference_range": entry.reference_range,
                "abnormal_flag": entry.abnormal_flag,
                "needs_manual_entry": entry.needs_manual_entry,
                "display_order": entry.display_order,
            }
        )
    get_supabase_admin().table(ENTRY_TABLE).insert(rows).execute()



_ALLOWED_TRANSITIONS = {
    "uploaded": {"reviewed", "released", "archived"},
    "reviewed": {"released", "archived", "uploaded"},
    "released": {"archived"},
    "archived": set(),
}


def patch(
    *,
    actor_user_id: str,
    provider_id: str,
    lab_result_id: str,
    payload: LabResultPatch,
) -> dict[str, Any]:
    row = _get_for_provider(lab_result_id, provider_id)

    updates: dict[str, Any] = {"updated_by": actor_user_id}
    if payload.lab_name is not None:
        updates["lab_name"] = payload.lab_name
    if payload.ordering_provider_name is not None:
        updates["ordering_provider_name"] = payload.ordering_provider_name
    if payload.collected_at is not None:
        updates["collected_at"] = _iso(payload.collected_at)
    if payload.resulted_at is not None:
        updates["resulted_at"] = _iso(payload.resulted_at)
    if payload.notes is not None:
        notes_enc = crypto.encrypt(
            payload.notes,
            aad=crypto.aad_for(LR_TABLE, lab_result_id, "notes"),
        )
        updates["notes_enc"] = _to_pg_bytea(notes_enc)

    if payload.transition_to_reviewed and row["status"] == "uploaded":
        updates["status"] = "reviewed"

    if len(updates) > 1:
        try:
            get_supabase_admin().table(LR_TABLE).update(updates).eq(
                "id", lab_result_id
            ).execute()
        except APIError as exc:
            raise _translate_pg_error(exc) from exc

    if payload.entries:
        _apply_entry_patches(lab_result_id, payload.entries)

    refreshed = _get_for_provider(lab_result_id, provider_id)
    return _to_detail(refreshed, _fetch_entries(lab_result_id), for_patient=False)


def _apply_entry_patches(lab_result_id: str, entry_patches) -> None:
    admin = get_supabase_admin()
    for patch_entry in entry_patches:
        if patch_entry.id:
            data: dict[str, Any] = {}
            if patch_entry.component_name is not None:
                data["component_name"] = patch_entry.component_name
            if patch_entry.loinc_code is not None:
                data["loinc_code"] = patch_entry.loinc_code
            if patch_entry.value is not None:
                data["value_enc"] = _to_pg_bytea(
                    crypto.encrypt(
                        patch_entry.value,
                        aad=crypto.aad_for(ENTRY_TABLE, patch_entry.id, "value"),
                    )
                )
            if patch_entry.value_numeric is not None:
                data["value_numeric"] = patch_entry.value_numeric
            if patch_entry.unit is not None:
                data["unit"] = patch_entry.unit
            if patch_entry.reference_range is not None:
                data["reference_range"] = patch_entry.reference_range
            if patch_entry.abnormal_flag is not None:
                data["abnormal_flag"] = patch_entry.abnormal_flag
            if patch_entry.needs_manual_entry is not None:
                data["needs_manual_entry"] = patch_entry.needs_manual_entry
            if patch_entry.display_order is not None:
                data["display_order"] = patch_entry.display_order
            if data:
                admin.table(ENTRY_TABLE).update(data).eq("id", patch_entry.id).eq(
                    "lab_result_id", lab_result_id
                ).execute()
        else:
            entry_id = str(uuid.uuid4())
            new_row: dict[str, Any] = {
                "id": entry_id,
                "lab_result_id": lab_result_id,
                "component_name": patch_entry.component_name or "(unnamed)",
                "loinc_code": patch_entry.loinc_code,
                "value_numeric": patch_entry.value_numeric,
                "unit": patch_entry.unit,
                "reference_range": patch_entry.reference_range,
                "abnormal_flag": patch_entry.abnormal_flag or "normal",
                "needs_manual_entry": bool(patch_entry.needs_manual_entry or False),
                "display_order": patch_entry.display_order or 0,
            }
            if patch_entry.value is not None:
                new_row["value_enc"] = _to_pg_bytea(
                    crypto.encrypt(
                        patch_entry.value,
                        aad=crypto.aad_for(ENTRY_TABLE, entry_id, "value"),
                    )
                )
            admin.table(ENTRY_TABLE).insert(new_row).execute()


def release(*, actor_user_id: str, provider_id: str, lab_result_id: str) -> dict[str, Any]:
    row = _get_for_provider(lab_result_id, provider_id)
    if row["status"] not in {"uploaded", "reviewed"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"cannot release from status '{row['status']}'",
        )
    updates = {
        "status": "released",
        "released_at": _iso(datetime.now(timezone.utc)),
        "released_by": actor_user_id,
        "updated_by": actor_user_id,
    }
    try:
        get_supabase_admin().table(LR_TABLE).update(updates).eq(
            "id", lab_result_id
        ).execute()
    except APIError as exc:
        raise _translate_pg_error(exc) from exc
    refreshed = _get_for_provider(lab_result_id, provider_id)
    return _to_detail(refreshed, _fetch_entries(lab_result_id), for_patient=False)


def archive(*, actor_user_id: str, provider_id: str, lab_result_id: str) -> dict[str, Any]:
    row = _get_for_provider(lab_result_id, provider_id)
    if row["status"] == "archived":
        return _to_detail(row, _fetch_entries(lab_result_id), for_patient=False)
    if "archived" not in _ALLOWED_TRANSITIONS[row["status"]]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"cannot archive from status '{row['status']}'",
        )
    try:
        get_supabase_admin().table(LR_TABLE).update(
            {"status": "archived", "updated_by": actor_user_id}
        ).eq("id", lab_result_id).execute()
    except APIError as exc:
        raise _translate_pg_error(exc) from exc
    refreshed = _get_for_provider(lab_result_id, provider_id)
    return _to_detail(refreshed, _fetch_entries(lab_result_id), for_patient=False)


def list_for_provider(
    *,
    provider_id: str,
    patient_id: str | None,
    status_filter: str | None,
    limit: int,
    offset: int,
) -> list[dict[str, Any]]:
    patient_ids = _patient_ids_for_provider(provider_id, patient_id)
    if not patient_ids:
        return []
    q = (
        get_supabase_admin()
        .table(LR_TABLE)
        .select(
            "id, patient_id, provider_id, source_format, status, lab_name, "
            "collected_at, resulted_at, released_at, created_at, updated_at"
        )
        .in_("patient_id", patient_ids)
        .is_("deleted_at", None)
        .order("resulted_at", desc=True)
        .range(offset, offset + limit - 1)
    )
    if status_filter:
        q = q.eq("status", status_filter)
    return q.execute().data or []


def list_for_patient(
    *, patient_id: str, limit: int, offset: int
) -> list[dict[str, Any]]:
    resp = (
        get_supabase_admin()
        .table(LR_TABLE)
        .select(
            "id, patient_id, provider_id, source_format, status, lab_name, "
            "collected_at, resulted_at, released_at, created_at, updated_at"
        )
        .eq("patient_id", patient_id)
        .eq("status", "released")
        .is_("deleted_at", None)
        .order("resulted_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return resp.data or []


def get_for_provider(*, provider_id: str, lab_result_id: str) -> dict[str, Any]:
    row = _get_for_provider(lab_result_id, provider_id)
    return _to_detail(row, _fetch_entries(lab_result_id), for_patient=False)


def get_for_patient(*, patient_id: str, lab_result_id: str) -> dict[str, Any]:
    row = _fetch_by_id(lab_result_id)
    if (
        not row
        or row["deleted_at"] is not None
        or row["patient_id"] != patient_id
        or row["status"] != "released"
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not found")
    return _to_detail(row, _fetch_entries(lab_result_id), for_patient=True)


def signed_file_url_for_provider(
    *, provider_id: str, lab_result_id: str, expires_in_seconds: int = 60
) -> str:
    row = _get_for_provider(lab_result_id, provider_id)
    return storage.signed_url(row["storage_path"], expires_in_seconds=expires_in_seconds)


def signed_file_url_for_patient(
    *, patient_id: str, lab_result_id: str, expires_in_seconds: int = 60
) -> str:
    row = _fetch_by_id(lab_result_id)
    if (
        not row
        or row["deleted_at"] is not None
        or row["patient_id"] != patient_id
        or row["status"] != "released"
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not found")
    return storage.signed_url(row["storage_path"], expires_in_seconds=expires_in_seconds)


def _fetch_by_id(lab_result_id: str) -> dict[str, Any] | None:
    resp = (
        get_supabase_admin()
        .table(LR_TABLE)
        .select("*")
        .eq("id", lab_result_id)
        .limit(1)
        .execute()
    )
    rows = resp.data or []
    return rows[0] if rows else None


def _get_for_provider(lab_result_id: str, provider_id: str) -> dict[str, Any]:
    row = _fetch_by_id(lab_result_id)
    if not row or row["deleted_at"] is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not found")
    require_active_relationship(provider_id, row["patient_id"])
    return row


def _fetch_entries(lab_result_id: str) -> list[dict[str, Any]]:
    resp = (
        get_supabase_admin()
        .table(ENTRY_TABLE)
        .select("*")
        .eq("lab_result_id", lab_result_id)
        .order("display_order")
        .execute()
    )
    return resp.data or []


def _patient_ids_for_provider(provider_id: str, patient_id: str | None) -> list[str]:
    now_iso = datetime.now(timezone.utc).isoformat()
    q = (
        get_supabase_admin()
        .table("patient_provider_relationships")
        .select("patient_id, started_at, ended_at")
        .eq("provider_id", provider_id)
        .lte("started_at", now_iso)
    )
    if patient_id:
        q = q.eq("patient_id", patient_id)
    rows = q.execute().data or []
    return [
        r["patient_id"]
        for r in rows
        if r["ended_at"] is None or r["ended_at"] > now_iso
    ]


def _soft_delete_lab_result(lab_result_id: str) -> None:
    try:
        get_supabase_admin().table(LR_TABLE).update(
            {"deleted_at": _iso(datetime.now(timezone.utc))}
        ).eq("id", lab_result_id).execute()
    except Exception:
        pass


def _safe_filename(name: str) -> str:
    base = name.replace("\\", "/").split("/")[-1] or "file"
    return "".join(c for c in base if c.isalnum() or c in ("-", "_", ".")) or "file"


def _iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    return (dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)).isoformat()


def _from_pg_bytea(value: Any) -> bytes | None:
    if value is None:
        return None
    if isinstance(value, (bytes, bytearray, memoryview)):
        return bytes(value)
    if isinstance(value, str) and value.startswith("\\x"):
        return bytes.fromhex(value[2:])
    if isinstance(value, str):
        try:
            return bytes.fromhex(value)
        except ValueError:
            return value.encode("utf-8")
    return None


def _to_pg_bytea(value: bytes | None) -> str | None:
    if value is None:
        return None
    return "\\x" + value.hex()


def _to_detail(
    row: dict[str, Any],
    entries: list[dict[str, Any]],
    *,
    for_patient: bool,
) -> dict[str, Any]:
    notes: str | None = None
    if not for_patient:
        notes_bytes = _from_pg_bytea(row.get("notes_enc"))
        if notes_bytes:
            try:
                notes = crypto.decrypt(
                    notes_bytes, aad=crypto.aad_for(LR_TABLE, row["id"], "notes")
                )
            except crypto.EnvelopeError:
                notes = None

    out_entries: list[dict[str, Any]] = []
    for e in entries:
        value = None
        v_bytes = _from_pg_bytea(e.get("value_enc"))
        if v_bytes:
            try:
                value = crypto.decrypt(
                    v_bytes, aad=crypto.aad_for(ENTRY_TABLE, e["id"], "value")
                )
            except crypto.EnvelopeError:
                value = None
        out_entries.append(
            {
                "id": e["id"],
                "loinc_code": e.get("loinc_code"),
                "component_name": e["component_name"],
                "value": value,
                "value_numeric": e.get("value_numeric"),
                "unit": e.get("unit"),
                "reference_range": e.get("reference_range"),
                "abnormal_flag": e.get("abnormal_flag", "normal"),
                "needs_manual_entry": e.get("needs_manual_entry", False),
                "display_order": e.get("display_order", 0),
            }
        )

    return {
        "id": row["id"],
        "patient_id": row["patient_id"],
        "provider_id": row["provider_id"],
        "diagnostic_order_id": row.get("diagnostic_order_id"),
        "storage_path": row["storage_path"],
        "source_format": row["source_format"],
        "status": row["status"],
        "lab_name": row["lab_name"],
        "ordering_provider_name": row.get("ordering_provider_name"),
        "collected_at": row.get("collected_at"),
        "resulted_at": row.get("resulted_at"),
        "released_at": row.get("released_at"),
        "released_by": row.get("released_by"),
        "parser_version": row["parser_version"],
        "parse_error": None if for_patient else row.get("parse_error"),
        "notes": notes,
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "entries": out_entries,
    }
