import os

from supabase import Client, create_client


_client: Client | None = None
_admin_client: Client | None = None


def get_supabase() -> Client:
    global _client
    if _client is None:
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_KEY")
        if not url or not key:
            raise RuntimeError(
                "SUPABASE_URL and SUPABASE_KEY must be set in the backend environment"
            )
        _client = create_client(url, key)
    return _client


def get_supabase_admin() -> Client:
    """Service-role client. Bypasses RLS — only the backend should hold this key."""
    global _admin_client
    if _admin_client is None:
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_SERVICE_KEY")
        if not url or not key:
            raise RuntimeError(
                "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in the backend environment"
            )
        _admin_client = create_client(url, key)
    return _admin_client
