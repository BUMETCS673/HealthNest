"""
AI-USAGE SUMMARY
Tools: Claude Code (Fable 5)
Overall AI Contribution: ~90%
AI-Assisted Areas: Wrote unit tests for the providers patient-overview service
(care-relationship enforcement, missing patient 404, payload shape).
Human Contributions: Reported the Quick Patient Lookup gap and reviewed the
expected chart payload shape.
"""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from providers import service


def _chained(rows):
    chain = MagicMock()
    for method in ("select", "eq", "is_", "order", "limit"):
        getattr(chain, method).return_value = chain
    chain.execute.return_value = SimpleNamespace(data=rows)
    return chain


def _admin(patients_rows, appointment_rows=None):
    admin = MagicMock()
    admin.table.side_effect = lambda name: _chained(
        patients_rows if name == "patients" else (appointment_rows or [])
    )
    return admin


_PATIENT_ROW = {
    "id": "pat-1",
    "user_id": "user-77",
    "first_name": "Alex",
    "last_name": "Morgan",
    "preferred_name": None,
    "mrn": "MRN-001",
    "date_of_birth": "1990-01-01",
}

_SECTIONS = {
    "recentHistory": [],
    "activeProblems": [],
    "medications": [],
    "labs": [],
    "openIssues": [],
    "missingSections": ["recent history"],
}


def test_patient_overview_requires_active_relationship():
    with patch.object(
        service,
        "require_active_relationship",
        side_effect=HTTPException(status_code=403, detail="No relationship."),
    ):
        with pytest.raises(HTTPException) as exc_info:
            service.get_patient_overview("prov-1", "pat-1")

    assert exc_info.value.status_code == 403


def test_patient_overview_404_when_patient_missing():
    with (
        patch.object(service, "require_active_relationship"),
        patch.object(service, "get_supabase_admin", return_value=_admin([])),
    ):
        with pytest.raises(HTTPException) as exc_info:
            service.get_patient_overview("prov-1", "pat-1")

    assert exc_info.value.status_code == 404


def test_patient_overview_payload_shape():
    appointment_rows = [
        {
            "id": "appt-8",
            "status": "completed",
            "notes": "Annual physical",
            "provider_availability": {
                "available_date": "2026-05-01",
                "available_time": "10:00:00",
            },
        },
        {
            "id": "appt-9",
            "status": "scheduled",
            "notes": "Follow-up",
            "provider_availability": {
                "available_date": "2026-06-01",
                "available_time": "09:30:00",
            },
        },
    ]
    with (
        patch.object(service, "require_active_relationship") as rel,
        patch.object(
            service,
            "get_supabase_admin",
            return_value=_admin([_PATIENT_ROW], appointment_rows),
        ),
        patch.object(service, "build_patient_sections", return_value=_SECTIONS),
    ):
        result = service.get_patient_overview("prov-1", "pat-1")

    rel.assert_called_once_with("prov-1", "pat-1")
    assert result["patient"] == {
        "id": "pat-1",
        "userId": "user-77",
        "name": "Alex Morgan",
        "initials": "AM",
        "mrn": "MRN-001",
        "dateOfBirth": "1990-01-01",
    }
    # Newest appointment first; hero shows the most recent one.
    assert [a["id"] for a in result["appointments"]] == ["appt-9", "appt-8"]
    assert result["appointment"]["id"] == "appt-9"
    assert result["appointment"]["date"] == "2026-06-01"
    assert result["appointment"]["time"] == "09:30:00"
    assert result["appointment"]["visitType"] == "Follow-up"
    assert result["missingSections"] == ["recent history"]


def test_patient_overview_handles_no_appointments():
    with (
        patch.object(service, "require_active_relationship"),
        patch.object(
            service, "get_supabase_admin", return_value=_admin([_PATIENT_ROW])
        ),
        patch.object(service, "build_patient_sections", return_value=_SECTIONS),
    ):
        result = service.get_patient_overview("prov-1", "pat-1")

    assert result["appointment"] is None
    assert result["appointments"] == []
    assert result["patient"]["name"] == "Alex Morgan"
