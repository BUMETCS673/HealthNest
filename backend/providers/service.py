from typing import Any

from auth.client import get_supabase


def get_providers() -> list[dict[str, Any]]:
    result = (
        get_supabase()
        .table("providers")
        .select("id, first_name, last_name, title, specialty, status")
        .eq("status", "active")
        .is_("deleted_at", "null")
        .order("specialty")
        .order("last_name")
        .execute()
    )
    return result.data
