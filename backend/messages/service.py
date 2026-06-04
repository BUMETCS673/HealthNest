from auth.client import get_supabase_admin
from .schemas import MessageCreate

def send_message(sender_id: str, payload: MessageCreate) -> dict:
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

def get_providers(user_id: str) -> list[dict]:
    result = (
        get_supabase_admin()
        .table("patient_provider_relationships")
        .select("provider_id")
        .eq("patient_id", user_id)
        .execute()
    )
    return result.data