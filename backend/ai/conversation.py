"""
AI-USAGE SUMMARY
Tools: Opus 4.7
Overall AI Contribution: ~65%
AI-Assisted Areas: Drafted the CRUD helpers against ai_conversations and ai_messages using the admin Supabase client pattern.
Human Contributions: Designed the message append shape (tool_calls + skill_outputs + citations are jsonb-native; tokens_in/tokens_out/latency_ms captured per turn), the tenancy guard inside fetch_conversation (caller's patient_id is asserted before any read), and the soft-delete semantics on delete_conversation.
"""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import HTTPException, status

from auth.client import get_supabase_admin, with_admin_retry


CONV_TABLE = "ai_conversations"
MSG_TABLE = "ai_messages"

def create_conversation(
    *,
    user_id: str,
    assistant_type: str,
    model: str,
    title: str | None = None,
    patient_id: str | None = None,
    provider_id: str | None = None,
) -> dict[str, Any]:
    row = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "assistant_type": assistant_type,
        "model": model,
        "title": title,
    }
    if patient_id:
        row["patient_id"] = patient_id

    if provider_id:
        row["provider_id"] = provider_id

    resp = get_supabase_admin().table(CONV_TABLE).insert(row).execute()
    if not resp.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="failed to create conversation",
        )
    return resp.data[0]


def list_conversations(
    *,
    patient_id: str | None = None,
    provider_id: str | None = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    query = (
        get_supabase_admin()
        .table(CONV_TABLE)
        .select("id, title, started_at, closed_at, model")
        .is_("deleted_at", None)
        .order("started_at", desc=True)
        .limit(limit)
    )

    if patient_id:
        query = query.eq("patient_id", patient_id)
    elif provider_id:
        query = query.eq("provider_id", provider_id)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="patient_id or provider_id is required",
        )

    resp = query.execute()

    convs = resp.data or []
    if not convs:
        return []

    ids = [c["id"] for c in convs]
    msgs_resp = (
        get_supabase_admin()
        .table(MSG_TABLE)
        .select("conversation_id, role, content, created_at")
        .in_("conversation_id", ids)
        .order("created_at", desc=True)
        .limit(limit * 6)
        .execute()
    )

    latest: dict[str, dict[str, Any]] = {}
    for m in msgs_resp.data or []:
        cid = m["conversation_id"]
        if cid not in latest and m["role"] in {"user", "assistant"}:
            latest[cid] = m

    for c in convs:
        m = latest.get(c["id"])
        c["last_message_at"] = m["created_at"] if m else None
        c["last_message_preview"] = (
            (m.get("content") or "")[:140] if m else None
        )

    return convs


def fetch_conversation(
    *,
    conversation_id: str,
    patient_id: str | None = None,
    provider_id: str | None = None,
) -> dict[str, Any]:

    def _do() -> dict[str, Any]:
        resp = (
            get_supabase_admin()
            .table(CONV_TABLE)
            .select("*")
            .eq("id", conversation_id)
            .is_("deleted_at", None)
            .limit(1)
            .execute()
        )

        rows = resp.data or []
        if not rows:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="conversation not found",
            )

        conv = rows[0]

        if patient_id and conv.get("patient_id") != patient_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="conversation not found",
            )

        if provider_id and conv.get("provider_id") != provider_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="conversation not found",
            )

        if not patient_id and not provider_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="patient_id or provider_id is required",
            )

        msgs_resp = (
            get_supabase_admin()
            .table(MSG_TABLE)
            .select("*")
            .eq("conversation_id", conversation_id)
            .order("created_at", desc=False)
            .execute()
        )

        conv["messages"] = msgs_resp.data or []
        return conv

    return with_admin_retry(_do)


def delete_conversation(
    *,
    conversation_id: str,
    patient_id: str | None = None,
    provider_id: str | None = None,
) -> None:
    fetch_conversation(
        conversation_id=conversation_id,
        patient_id=patient_id,
        provider_id=provider_id,
    )

    get_supabase_admin().table(CONV_TABLE).update(
        {"deleted_at": "now()"}
    ).eq("id", conversation_id).execute()

def append_message(
    *,
    conversation_id: str,
    role: str,
    content: str | None = None,
    skill: str | None = None,
    tool_calls: list[dict[str, Any]] | None = None,
    skill_outputs: list[dict[str, Any]] | None = None,
    citations: list[dict[str, Any]] | None = None,
    tokens_in: int | None = None,
    tokens_out: int | None = None,
    latency_ms: int | None = None,
) -> dict[str, Any]:
    row: dict[str, Any] = {
        "id": str(uuid.uuid4()),
        "conversation_id": conversation_id,
        "role": role,
        "content": content,
        "skill": skill,
        "tool_calls": tool_calls,
        "skill_outputs": skill_outputs,
        "citations": citations,
        "tokens_in": tokens_in,
        "tokens_out": tokens_out,
        "latency_ms": latency_ms,
    }

    def _do() -> dict[str, Any]:
        resp = get_supabase_admin().table(MSG_TABLE).insert(row).execute()
        if not resp.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="failed to append message",
            )
        return resp.data[0]

    return with_admin_retry(_do)


def _history_query(conversation_id: str, limit: int) -> list[dict[str, Any]]:
    resp = (
        get_supabase_admin()
        .table(MSG_TABLE)
        .select("role, content")
        .eq("conversation_id", conversation_id)
        .order("created_at", desc=False)
        .limit(limit)
        .execute()
    )
    return resp.data or []


def history_for_openai(*, conversation_id: str, limit: int = 30) -> list[dict[str, Any]]:
    rows = with_admin_retry(_history_query, conversation_id, limit)
    out: list[dict[str, Any]] = []
    for m in rows:
        role = m["role"]
        content = (m.get("content") or "").strip()
        if role == "user":
            out.append({"role": "user", "content": m.get("content") or ""})
        elif role == "assistant" and content:
            out.append({"role": "assistant", "content": content})
    return out
