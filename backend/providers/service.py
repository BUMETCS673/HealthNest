# AI-USAGE SUMMARY 
# Tools: Claude Code
# Overall AI Contribution: ~60% 
# AI-Assisted Areas: Implementing the function to retrieve providers from the database.
# Human Contributions: Defining the business logic and integrating them with the router and schemas.
# Notes: AI was used to help quickly set up the basic structure of our service layer and to implement
# the core function for getting provider information.


from typing import Any

from fastapi import HTTPException, status

from auth.client import get_supabase, get_supabase_admin
from auth.deps import require_active_relationship
from ai.skills.visit_overview_skill import build_patient_sections


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


def _full_name(patient: dict[str, Any]) -> str:
    first = patient.get("preferred_name") or patient.get("first_name") or ""
    last = patient.get("last_name") or ""
    return f"{first} {last}".strip() or "Unknown Patient"


def _initials(patient: dict[str, Any]) -> str:
    first = (patient.get("preferred_name") or patient.get("first_name") or "")[:1]
    last = (patient.get("last_name") or "")[:1]
    return (first + last).upper() or "PT"


def _latest_appointment(admin: Any, patient_id: str) -> dict[str, Any] | None:
    try:
        resp = (
            admin.table("appointments")
            .select("id, appointment_date, appointment_time, status, notes")
            .eq("patient_id", patient_id)
            .order("appointment_date", desc=True)
            .order("appointment_time", desc=True)
            .limit(1)
            .execute()
        )
        rows = resp.data or []
        if not rows:
            return None
        appt = rows[0]
        return {
            "id": appt.get("id"),
            "time": appt.get("appointment_time"),
            "date": appt.get("appointment_date"),
            "visitType": appt.get("notes") or "Visit",
            "status": appt.get("status"),
        }
    except Exception:
        return None


def get_patient_overview(provider_id: str, patient_id: str) -> dict[str, Any]:
    """Chart payload for one patient, opened from Quick Patient Lookup.

    Same shape as the visit-overview detail payload so the frontend
    full-chart view can render it, but keyed by patient instead of
    appointment."""
    require_active_relationship(provider_id, patient_id)

    admin = get_supabase_admin()
    resp = (
        admin.table("patients")
        .select("id, first_name, last_name, preferred_name, mrn, date_of_birth")
        .eq("id", patient_id)
        .is_("deleted_at", None)
        .limit(1)
        .execute()
    )
    rows = resp.data or []
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found.",
        )
    patient = rows[0]

    return {
        "patient": {
            "id": patient.get("id"),
            "name": _full_name(patient),
            "initials": _initials(patient),
            "mrn": patient.get("mrn"),
            "dateOfBirth": patient.get("date_of_birth"),
        },
        "appointment": _latest_appointment(admin, patient_id),
        **build_patient_sections(admin, patient_id),
    }
