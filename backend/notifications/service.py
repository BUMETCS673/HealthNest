# AI-USAGE SUMMARY
# Tools: Claude Code (Opus 4.8)
# Overall AI Contribution: ~90%
# AI-Assisted Areas: The notification feed (#SCRUM-76). Read-only aggregation of
#   recent activity for the signed-in user — new messages received, new
#   appointments (patient: booked with a provider / provider: booked by a
#   patient), and newly released lab results — merged and sorted into one feed.
#   Derives notifications from the existing tables instead of maintaining a
#   separate notifications table, so no event-producing code has to change; the
#   frontend owns the "seen" state and the unread badge.
# Human Contributions: Which events count as notifications and the role-based
#   routing; verification.
# Notes: Validated via pytest and manual API testing.
from datetime import datetime, timedelta, timezone
from typing import Any

from auth.client import get_supabase_admin

LOOKBACK_DAYS = 30
MAX_ITEMS = 30


def _full_name(row: dict, with_title: bool = False) -> str:
    parts = []
    if with_title and row.get("title"):
        parts.append(row["title"])
    parts.append(row.get("first_name") or "")
    parts.append(row.get("last_name") or "")
    return " ".join(p for p in parts if p).strip()


def _names_for_auth_ids(admin, user_ids: list[str]) -> dict[str, str]:
    """Map auth user_id -> display name (a provider's 'Dr. X' is preferred)."""
    ids = [u for u in {*user_ids} if u]
    if not ids:
        return {}
    out: dict[str, str] = {}
    provs = (
        admin.table("providers")
        .select("user_id, title, first_name, last_name")
        .in_("user_id", ids)
        .execute()
    )
    for p in provs.data or []:
        if p.get("user_id"):
            out[p["user_id"]] = _full_name(p, with_title=True)
    pats = (
        admin.table("patients")
        .select("user_id, first_name, last_name")
        .in_("user_id", ids)
        .execute()
    )
    for p in pats.data or []:
        if p.get("user_id") and p["user_id"] not in out:
            out[p["user_id"]] = _full_name(p)
    return out


def _names_by_id(admin, table: str, ids: list[str], with_title: bool) -> dict[str, str]:
    wanted = [i for i in {*ids} if i]
    if not wanted:
        return {}
    cols = "id, first_name, last_name" + (", title" if with_title else "")
    res = admin.table(table).select(cols).in_("id", wanted).execute()
    return {r["id"]: _full_name(r, with_title=with_title) for r in res.data or []}


def get_notifications(user_id: str) -> list[dict[str, Any]]:
    """Aggregate recent activity into a notification feed for the current user."""
    admin = get_supabase_admin()
    since = (datetime.now(timezone.utc) - timedelta(days=LOOKBACK_DAYS)).isoformat()
    items: list[dict[str, Any]] = []

    pat = (
        admin.table("patients")
        .select("id")
        .eq("user_id", user_id)
        .is_("deleted_at", "null")
        .limit(1)
        .execute()
    )
    patient = pat.data[0] if pat.data else None

    prv = (
        admin.table("providers")
        .select("id")
        .eq("user_id", user_id)
        .is_("deleted_at", "null")
        .limit(1)
        .execute()
    )
    provider = prv.data[0] if prv.data else None

    # ── New messages received ──
    msgs = (
        admin.table("messages")
        .select("id, sender_id, body, sent_at")
        .eq("recipient_id", user_id)
        .gte("sent_at", since)
        .order("sent_at", desc=True)
        .limit(MAX_ITEMS)
        .execute()
    )
    senders = _names_for_auth_ids(admin, [m["sender_id"] for m in (msgs.data or [])])
    for m in msgs.data or []:
        who = senders.get(m.get("sender_id"), "a member of your care team")
        items.append(
            {
                "id": f"msg-{m['id']}",
                "type": "message",
                "title": f"New message from {who}",
                "body": (m.get("body") or "").strip()[:90],
                "created_at": m.get("sent_at"),
                "contact_id": m.get("sender_id"),
            }
        )

    # ── Appointments (patient: booked with a provider; provider: by a patient) ──
    if patient:
        appts = (
            admin.table("appointments")
            .select("id, provider_id, created_at")
            .eq("patient_id", patient["id"])
            .gte("created_at", since)
            .order("created_at", desc=True)
            .limit(MAX_ITEMS)
            .execute()
        )
        names = _names_by_id(
            admin, "providers", [a.get("provider_id") for a in (appts.data or [])], True
        )
        for a in appts.data or []:
            who = names.get(a.get("provider_id"), "your provider")
            items.append(
                {
                    "id": f"appt-{a['id']}",
                    "type": "appointment",
                    "title": f"Appointment booked with {who}",
                    "body": "",
                    "created_at": a.get("created_at"),
                    "nav": "appointments",
                }
            )
    if provider:
        appts = (
            admin.table("appointments")
            .select("id, patient_id, created_at")
            .eq("provider_id", provider["id"])
            .gte("created_at", since)
            .order("created_at", desc=True)
            .limit(MAX_ITEMS)
            .execute()
        )
        names = _names_by_id(
            admin, "patients", [a.get("patient_id") for a in (appts.data or [])], False
        )
        for a in appts.data or []:
            who = names.get(a.get("patient_id"), "a patient")
            items.append(
                {
                    "id": f"appt-{a['id']}",
                    "type": "appointment",
                    "title": f"New appointment with {who}",
                    "body": "",
                    "created_at": a.get("created_at"),
                    "nav": "schedule",
                }
            )

    # ── Newly released lab results (patients) ──
    if patient:
        labs = (
            admin.table("lab_results")
            .select("id, lab_name, released_at")
            .eq("patient_id", patient["id"])
            .is_("deleted_at", "null")
            .gte("released_at", since)
            .order("released_at", desc=True)
            .limit(MAX_ITEMS)
            .execute()
        )
        for lab in labs.data or []:
            items.append(
                {
                    "id": f"lab-{lab['id']}",
                    "type": "lab",
                    "title": f"New lab result: {lab.get('lab_name') or 'Lab result'}",
                    "body": "",
                    "created_at": lab.get("released_at"),
                    "nav": "labs",
                }
            )

    items.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    return items[:MAX_ITEMS]
