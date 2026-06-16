"""
AI-USAGE SUMMARY
Tools: Claude Code (Fable 5)
Overall AI Contribution: ~90%
AI-Assisted Areas: Wrote the unit tests covering role validation during sign-in
(mismatched role rejected, matching role accepted, no-role requests unchanged).
Human Contributions: Reported the bug (provider toggle accepted patient
credentials) and reviewed the expected behavior.
"""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from auth import service
from auth.schemas import SignInRequest


def _fake_auth_result():
    user = SimpleNamespace(
        model_dump=lambda mode=None: {
            "id": "user-123",
            "email": "alex@example.com",
            "user_metadata": {"role": "patient"},
        }
    )
    session = SimpleNamespace(
        model_dump=lambda mode=None: {
            "access_token": "token",
            "refresh_token": "refresh",
            "user": {"id": "user-123"},
        }
    )
    return SimpleNamespace(user=user, session=session)


def _supabase_with_password_auth():
    supabase = MagicMock()
    supabase.auth.sign_in_with_password.return_value = _fake_auth_result()
    return supabase


def _admin_returning(rows):
    admin = MagicMock()
    (
        admin.table.return_value.select.return_value.eq.return_value.is_.return_value.limit.return_value.execute.return_value
    ) = SimpleNamespace(data=rows)
    return admin


def test_sign_in_rejects_role_without_profile():
    payload = SignInRequest(
        email="alex@example.com", password="password123", role="provider"
    )
    with (
        patch.object(service, "get_supabase", return_value=_supabase_with_password_auth()),
        patch.object(service, "get_supabase_admin", return_value=_admin_returning([])),
    ):
        with pytest.raises(HTTPException) as exc_info:
            service.sign_in(payload)

    assert exc_info.value.status_code == 403
    assert "provider" in exc_info.value.detail


def test_sign_in_accepts_role_with_profile():
    payload = SignInRequest(
        email="alex@example.com", password="password123", role="provider"
    )
    admin = _admin_returning([{"id": "prov-1"}])
    with (
        patch.object(service, "get_supabase", return_value=_supabase_with_password_auth()),
        patch.object(service, "get_supabase_admin", return_value=admin),
    ):
        result = service.sign_in(payload)

    assert result["session"]["access_token"] == "token"
    admin.table.assert_called_once_with("providers")


def test_sign_in_without_role_skips_validation():
    payload = SignInRequest(email="alex@example.com", password="password123")
    admin = MagicMock()
    with (
        patch.object(service, "get_supabase", return_value=_supabase_with_password_auth()),
        patch.object(service, "get_supabase_admin", return_value=admin),
    ):
        result = service.sign_in(payload)

    assert result["session"]["access_token"] == "token"
    admin.table.assert_not_called()


def test_sign_in_falls_back_to_metadata_role_when_lookup_fails():
    payload = SignInRequest(
        email="alex@example.com", password="password123", role="patient"
    )
    admin = MagicMock()
    admin.table.side_effect = RuntimeError("db unavailable")
    with (
        patch.object(service, "get_supabase", return_value=_supabase_with_password_auth()),
        patch.object(service, "get_supabase_admin", return_value=admin),
    ):
        result = service.sign_in(payload)

    assert result["session"]["access_token"] == "token"
