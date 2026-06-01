"""
AI-USAGE SUMMARY
Tools: Opus 4.7
Overall AI Contribution: ~60%
AI-Assisted Areas: Drafted the AuditKind enum + the log() helper that writes to ai_audit_events via the admin Supabase client.
Human Contributions: Selected the event taxonomy to satisfy SCRUM-49 + AT2 (TENANCY_VIOLATION_BLOCKED must be logged), made the writer best-effort (audit failures must never raise into the request path), and gated SQL-key conversion through a single _row builder so the table schema stays the single source of truth.
"""

from __future__ import annotations

import enum
import logging
from typing import Any

from auth.client import get_supabase_admin


_TABLE = "ai_audit_events"
_log = logging.getLogger(__name__)


class AuditKind(str, enum.Enum):
    CONVERSATION_STARTED = "CONVERSATION_STARTED"
    CONVERSATION_DELETED = "CONVERSATION_DELETED"
    MESSAGE_SENT = "MESSAGE_SENT"
    RETRIEVAL_PERFORMED = "RETRIEVAL_PERFORMED"
    SKILL_DISPATCHED = "SKILL_DISPATCHED"
    SKILL_FAILED = "SKILL_FAILED"
    TENANCY_VIOLATION_BLOCKED = "TENANCY_VIOLATION_BLOCKED"
    ASSISTANT_REPLIED = "ASSISTANT_REPLIED"
    EMERGENCY_DETECTED = "EMERGENCY_DETECTED"
    OUT_OF_SCOPE_DEFERRED = "OUT_OF_SCOPE_DEFERRED"
    INGEST_RUN = "INGEST_RUN"


def log(
    kind: AuditKind,
    *,
    patient_id: str | None = None,
    actor_user_id: str | None = None,
    conversation_id: str | None = None,
    payload: dict[str, Any] | None = None,
) -> None:
    row = {
        "patient_id": patient_id,
        "actor_user_id": actor_user_id,
        "conversation_id": conversation_id,
        "event_kind": kind.value,
        "payload": payload or {},
    }
    try:
        get_supabase_admin().table(_TABLE).insert(row).execute()
    except Exception as exc:
        _log.warning("ai_audit_events insert failed: %s", exc)
