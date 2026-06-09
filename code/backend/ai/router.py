"""
AI-USAGE SUMMARY
Tools: Opus 4.7
Overall AI Contribution: ~65%
AI-Assisted Areas: Drafted the FastAPI routes (create / list / get / delete conversation + send message + ingest) and the SSE EventSourceResponse wiring.
Human Contributions: Every endpoint uses Depends(current_patient) and re-asserts patient ownership on the conversation row so AT2's auth-layer guarantee is tight; the ingest endpoint is patient-scoped (each patient ingests their own data) so it never accidentally fans out.
"""

from __future__ import annotations

from typing import Any

import logging
import os

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sse_starlette.sse import EventSourceResponse

from auth.client import reset_supabase_admin
from auth.deps import current_patient, current_user

from . import conversation as conv_store
from .assistant import AssistantContext, PatientFacingAssistant
from .audit import AuditKind, log as audit_log
from .client import chat_model
from .retrieval import ingest_for_patient
from .schemas import (
    ConversationCreate,
    ConversationDetail,
    ConversationSummary,
    IngestResult,
    MessageOut,
    MessageSend,
)


_log = logging.getLogger(__name__)


def _auto_ingest_enabled() -> bool:
    return os.environ.get("PULSE_AUTO_INGEST", "true").lower() not in {"0", "false", "no"}


def _safe_background_ingest(patient_id: str, actor_user_id: str) -> None:
    try:
        ingest_for_patient(patient_id=patient_id, actor_user_id=actor_user_id)
    except Exception as exc:
        _log.warning("background ingest failed for patient=%s: %s", patient_id, exc)
    finally:
        reset_supabase_admin()


router = APIRouter(prefix="/ai", tags=["ai"])

@router.post(
    "/conversations",
    response_model=ConversationSummary,
    status_code=status.HTTP_201_CREATED,
)
def create_conversation(
    payload: ConversationCreate,
    background: BackgroundTasks,
    patient: dict[str, Any] = Depends(current_patient),
    user: dict[str, Any] = Depends(current_user),
) -> ConversationSummary:
    row = conv_store.create_conversation(
        patient_id=patient["id"],
        user_id=user["id"],
        assistant_type="pfa",
        model=chat_model(),
        title=payload.title,
    )
    audit_log(
        AuditKind.CONVERSATION_STARTED,
        patient_id=patient["id"],
        actor_user_id=user["id"],
        conversation_id=row["id"],
    )
    if _auto_ingest_enabled():
        background.add_task(_safe_background_ingest, patient["id"], user["id"])
    return ConversationSummary(
        id=row["id"],
        title=row.get("title"),
        started_at=row["started_at"],
        closed_at=row.get("closed_at"),
        model=row["model"],
    )


@router.get("/conversations", response_model=list[ConversationSummary])
def list_conversations(
    patient: dict[str, Any] = Depends(current_patient),
) -> list[ConversationSummary]:
    rows = conv_store.list_conversations(patient_id=patient["id"])
    return [ConversationSummary(**r) for r in rows]


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
def get_conversation(
    conversation_id: str,
    patient: dict[str, Any] = Depends(current_patient),
) -> ConversationDetail:
    row = conv_store.fetch_conversation(
        conversation_id=conversation_id, patient_id=patient["id"]
    )
    return ConversationDetail(
        id=row["id"],
        title=row.get("title"),
        started_at=row["started_at"],
        closed_at=row.get("closed_at"),
        model=row["model"],
        messages=[MessageOut(**m) for m in row.get("messages", [])],
    )


@router.delete(
    "/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT
)
def delete_conversation(
    conversation_id: str,
    patient: dict[str, Any] = Depends(current_patient),
    user: dict[str, Any] = Depends(current_user),
) -> None:
    conv_store.delete_conversation(
        conversation_id=conversation_id, patient_id=patient["id"]
    )
    audit_log(
        AuditKind.CONVERSATION_DELETED,
        patient_id=patient["id"],
        actor_user_id=user["id"],
        conversation_id=conversation_id,
    )

_assistant = PatientFacingAssistant()


@router.post("/conversations/{conversation_id}/messages")
def send_message(
    conversation_id: str,
    payload: MessageSend,
    patient: dict[str, Any] = Depends(current_patient),
    user: dict[str, Any] = Depends(current_user),
):
    conv = conv_store.fetch_conversation(
        conversation_id=conversation_id, patient_id=patient["id"]
    )
    if conv["patient_id"] != patient["id"]:  # belt + suspenders
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="forbidden")

    ctx = AssistantContext(
        patient_id=patient["id"],
        user_id=user["id"],
        conversation_id=conversation_id,
        assistant_type="pfa",
    )

    def event_stream():
        for event in _assistant.ask(ctx, payload.content):
            yield event.to_sse()

    return EventSourceResponse(event_stream())

@router.post("/ingest", response_model=IngestResult)
def ingest(
    patient: dict[str, Any] = Depends(current_patient),
    user: dict[str, Any] = Depends(current_user),
) -> IngestResult:
    result = ingest_for_patient(
        patient_id=patient["id"], actor_user_id=user["id"]
    )
    return IngestResult(**result)
