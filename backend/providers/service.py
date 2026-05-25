# AI-USAGE SUMMARY 
# Tools: Claude Code
# Overall AI Contribution: ~60% 
# AI-Assisted Areas: Implementing the function to retrieve providers from the database.
# Human Contributions: Defining the business logic and integrating them with the router and schemas.
# Notes: AI was used to help quickly set up the basic structure of our service layer and to implement
# the core function for getting provider information.


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
