# AI-USAGE SUMMARY
# Tools: Claude Code (Opus 4.8)
# Overall AI Contribution: ~50%
# AI-Assisted Areas: Relationship-gated send, contacts/thread/mark-read and
#   unread-count queries, and the auth-id -> patients/providers id resolution.
# Human Contributions: Standardized "active" on the status column, the UUID guard
#   on get_thread, and the identity-mapping decisions.
# Notes: Validated via py_compile and manual API testing.
import uuid
from datetime import datetime, timezone
from fastapi import HTTPException, status
from auth.client import get_supabase_admin
from .schemas import MessageCreate

def _resolve_roles(user_id: str) -> tuple[str | None, str | None]:
    """Map an auth user id → (patients.id, providers.id); either may be None."""
    admin = get_supabase_admin()
    p = (admin.table("patients").select("id")
         .eq("user_id", user_id).is_("deleted_at", None).limit(1).execute())
    pr = (admin.table("providers").select("id")
          .eq("user_id", user_id).is_("deleted_at", None).limit(1).execute())
    patient_id = p.data[0]["id"] if p.data else None
    provider_id = pr.data[0]["id"] if pr.data else None
    return patient_id, provider_id


def _relationship_active(patient_id: str, provider_id: str) -> bool:
    rel = (get_supabase_admin().table("patient_provider_relationships")
           .select("id")
           .eq("patient_id", patient_id)
           .eq("provider_id", provider_id)
           .eq("status", "active")
           .limit(1).execute())
    return bool(rel.data)

def send_message(sender_id: str, payload: MessageCreate) -> dict:
    if sender_id == payload.recipient_id:
        raise HTTPException(status_code=400, detail="You cannot message yourself.")
    if not users_share_active_relationship(sender_id, payload.recipient_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only message members of your care team.",
        )
    result = (
        get_supabase_admin()
        .table("messages")
        .insert({
            "sender_id":    sender_id,
            "recipient_id": payload.recipient_id,
            "body":         payload.body,
        })
        .execute()
    )
    return result.data[0]

def get_inbox(user_id: str) -> list[dict]:
    result = (
        get_supabase_admin()
        .table("messages")
        .select("*")
        .eq("recipient_id", user_id)
        .order("sent_at", desc=True)
        .execute()
    )
    return result.data


def get_unread_counts(user_id: str) -> dict[str, int]:
    """Unread message counts addressed to `user_id`, grouped by sender."""
    result = (
        get_supabase_admin()
        .table("messages")
        .select("sender_id")
        .eq("recipient_id", user_id)
        .is_("read_at", None)
        .execute()
    )
    counts: dict[str, int] = {}
    for row in result.data or []:
        sid = row.get("sender_id")
        if sid:
            counts[sid] = counts.get(sid, 0) + 1
    return counts

def users_share_active_relationship(user_a: str, user_b: str) -> bool:
    """True if one user is a patient and the other their active provider (either direction)."""
    a_patient, a_provider = _resolve_roles(user_a)
    b_patient, b_provider = _resolve_roles(user_b)

    pairs = []
    if a_patient and b_provider:
        pairs.append((a_patient, b_provider))
    if b_patient and a_provider:
        pairs.append((b_patient, a_provider))

    return any(_relationship_active(pid, prid) for pid, prid in pairs)


def get_contacts(user_id: str) -> list[dict]:
    admin = get_supabase_admin()
    patient_id, provider_id = _resolve_roles(user_id)

    if patient_id:
        rels = (admin.table("patient_provider_relationships").select("provider_id")
                .eq("patient_id", patient_id).eq("status", "active").execute())
        ids = [r["provider_id"] for r in rels.data]
        if not ids:
            return []
        provs = (admin.table("providers")
                 .select("user_id, title, first_name, last_name, specialty")
                 .in_("id", ids).execute())
        return [
            {
                "user_id": p["user_id"],
                "name": " ".join(x for x in [p.get("title"), p["first_name"], p["last_name"]] if x),
                "specialty": p.get("specialty"),
            }
            for p in provs.data if p.get("user_id")   # skip providers with no auth account
        ]

    if provider_id:
        rels = (admin.table("patient_provider_relationships").select("patient_id")
                .eq("provider_id", provider_id).eq("status", "active").execute())
        ids = [r["patient_id"] for r in rels.data]
        if not ids:
            return []
        pats = (admin.table("patients")
                .select("user_id, first_name, last_name").in_("id", ids).execute())
        return [
            {
                "user_id": p["user_id"],
                "name": f'{p["first_name"]} {p["last_name"]}',
                "specialty": None,
            }
            for p in pats.data if p.get("user_id")
        ]

    return []


def get_thread(user_id: str, contact_id: str) -> list[dict]:
    try:
        uuid.UUID(contact_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid contact id.")

    result = (
        get_supabase_admin()
        .table("messages")
        .select("*")
        .or_(
            f"and(sender_id.eq.{user_id},recipient_id.eq.{contact_id}),"
            f"and(sender_id.eq.{contact_id},recipient_id.eq.{user_id})"
        )
        .order("sent_at", desc=False)
        .execute()
    )
    return result.data


def mark_thread_read(user_id: str, contact_id: str) -> None:
    now_iso = datetime.now(timezone.utc).isoformat()
    (get_supabase_admin().table("messages")
     .update({"read_at": now_iso})
     .eq("sender_id", contact_id)        
     .eq("recipient_id", user_id)        
     .is_("read_at", None)               
     .execute())