from __future__ import annotations

import mimetypes

from auth.client import get_supabase_admin


BUCKET = "lab_results"


def upload(*, path: str, content: bytes, filename: str) -> None:
    mime, _ = mimetypes.guess_type(filename)
    get_supabase_admin().storage.from_(BUCKET).upload(
        path=path,
        file=content,
        file_options={
            "content-type": mime or "application/octet-stream",
            "upsert": "false",
        },
    )


def remove(path: str) -> None:
    get_supabase_admin().storage.from_(BUCKET).remove([path])


def signed_url(path: str, *, expires_in_seconds: int = 60) -> str:
    resp = (
        get_supabase_admin()
        .storage.from_(BUCKET)
        .create_signed_url(path, expires_in_seconds)
    )
    return (
        resp.get("signedURL")
        or resp.get("signed_url")
        or resp.get("signedUrl")
        or ""
    )
