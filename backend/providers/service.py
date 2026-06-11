# AI-USAGE SUMMARY 
# Tools: Claude Code
# Overall AI Contribution: ~60% 
# AI-Assisted Areas: Implementing the function to retrieve providers from the database.
# Human Contributions: Defining the business logic and integrating them with the router and schemas.
# Notes: AI was used to help quickly set up the basic structure of our service layer and to implement
# the core function for getting provider information.


from typing import Any

from auth.client import get_supabase_admin


def get_providers() -> list[dict[str, Any]]:
    # Use the admin (service-role) client like the rest of this module:
    # row-level security blocks the anon client from reading `providers`, so the
    # anon client returns an empty directory and the booking page shows no
    # providers to choose from.
    result = (
        get_supabase_admin()
        .table("providers")
        .select("id, first_name, last_name, title, specialty, status")
        .eq("status", "active")
        .is_("deleted_at", "null")
        .order("specialty")
        .order("last_name")
        .execute()
    )
    return result.data


def get_care_team(patient_id: str) -> list[dict[str, Any]]:
    """Return the providers the given patient has an active relationship with."""
    admin = get_supabase_admin()
    rels = (
        admin.table("patient_provider_relationships")
        .select("provider_id")
        .eq("patient_id", patient_id)
        .eq("status", "active")
        .execute()
    )
    provider_ids = [r["provider_id"] for r in (rels.data or [])]
    if not provider_ids:
        return []

    result = (
        admin.table("providers")
        .select("id, user_id, first_name, last_name, title, specialty, status")
        .in_("id", provider_ids)
        .is_("deleted_at", "null")
        .order("last_name")
        .execute()
    )
    return result.data
