# AI-USAGE SUMMARY
# Tools: Claude Code (Opus 4.8)
# Overall AI Contribution: ~75%
# AI-Assisted Areas: Tests for GET /providers/care-team — the patient's active
#   care-team providers (populated and empty cases), with the two Supabase
#   queries mocked and current_patient_id overridden.
# Human Contributions: Test cases and expectations.
# Notes: Validated via pytest.
from unittest.mock import patch, MagicMock

from fastapi.testclient import TestClient
from main import app
from auth.deps import current_patient_id

FAKE_PATIENT_ID = "cccccccc-0000-0000-0000-000000000003"


def _make_admin(rel_rows, provider_rows):
    """Build a get_supabase_admin() mock returning rel_rows then provider_rows."""
    admin = MagicMock()

    rel_q = MagicMock()
    rel_q.execute.return_value.data = rel_rows

    prov_q = MagicMock()
    prov_q.execute.return_value.data = provider_rows

    def table(name):
        t = MagicMock()
        if name == "patient_provider_relationships":
            t.select.return_value.eq.return_value.eq.return_value = rel_q
        else:  # providers
            (
                t.select.return_value.in_.return_value.is_.return_value.order
                .return_value
            ) = prov_q
        return t

    admin.table.side_effect = table
    return admin


def test_care_team_returns_active_providers():
    app.dependency_overrides[current_patient_id] = lambda: FAKE_PATIENT_ID
    admin = _make_admin(
        [{"provider_id": "prov-1"}],
        [
            {
                "id": "prov-1",
                "user_id": "user-emily",
                "first_name": "Emily",
                "last_name": "Park",
                "title": "Dr.",
                "specialty": "Cardiology",
                "status": "active",
            }
        ],
    )
    try:
        with patch("providers.service.get_supabase_admin", return_value=admin):
            with TestClient(app) as c:
                resp = c.get("/providers/care-team")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["last_name"] == "Park"
        assert data[0]["specialty"] == "Cardiology"
        assert data[0]["user_id"] == "user-emily"
    finally:
        app.dependency_overrides.clear()


def test_care_team_empty_when_no_relationships():
    app.dependency_overrides[current_patient_id] = lambda: FAKE_PATIENT_ID
    admin = _make_admin([], [])
    try:
        with patch("providers.service.get_supabase_admin", return_value=admin):
            with TestClient(app) as c:
                resp = c.get("/providers/care-team")
        assert resp.status_code == 200
        assert resp.json() == []
    finally:
        app.dependency_overrides.clear()
