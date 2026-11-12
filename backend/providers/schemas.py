# AI-USAGE SUMMARY 
# Tools: Claude Code
# Overall AI Contribution: ~30% 
# AI-Assisted Areas: Initial set up of provider schema to match our Supabase provider table, defining the fields and their types.
# Human Contributions: Defining the schema and creating validation rules for provider data models.
# Notes: We reviewed the generated schemas and made adjustments to ensure they align with our application's requirements. 
# We also helped integrate these schemas with the routers and service layers of our application.


from pydantic import BaseModel


class ProviderOut(BaseModel):
    id: str
    first_name: str
    last_name: str
    title: str | None = None
    specialty: str | None = None
    status: str


class CareTeamProvider(ProviderOut):
    # The provider's auth user id, used by the UI to open their message thread.
    user_id: str | None = None
