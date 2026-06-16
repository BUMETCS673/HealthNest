import logging
import os
from typing import Any, Callable

from supabase import Client, create_client


_log = logging.getLogger(__name__)
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


def reset_supabase_admin() -> None:
    global _admin_client
    _admin_client = None


def _is_disconnect_error(exc: BaseException) -> bool:
    name = type(exc).__name__
    if name in {"RemoteProtocolError", "ConnectError", "ReadError", "WriteError"}:
        return True
    msg = str(exc).lower()
    return (
        "server disconnected" in msg
        or "connection reset" in msg
        or "remote protocol" in msg
        or "connection terminated" in msg
    )


def with_admin_retry[T](
    fn: Callable[..., T],
    *args: Any,
    **kwargs: Any,
) -> T:
    try:
        return fn(*args, **kwargs)
    except Exception as exc:  # noqa: BLE001
        if not _is_disconnect_error(exc):
            raise
        _log.warning(
            "admin client disconnect on %s; resetting + retrying once", fn.__name__
        )
        reset_supabase_admin()
        return fn(*args, **kwargs)
