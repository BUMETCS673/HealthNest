# AI-USAGE SUMMARY 
# Tools: Claude Code
# Overall AI Contribution: ~60% 
# AI-Assisted Areas: Implementing the function to retrieve providers from the database.
# Human Contributions: Defining the business logic and integrating them with the router and schemas.
# Notes: AI was used to help quickly set up the basic structure of our service layer and to implement
# the core function for getting provider information.


from typing import Any

from fastapi import HTTPException, status

from auth.client import get_supabase_admin
from auth.deps import require_active_relationship
from ai.skills.visit_overview_skill import build_patient_sections


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


def _full_name(patient: dict[str, Any]) -> str:
    first = patient.get("preferred_name") or patient.get("first_name") or ""
    last = patient.get("last_name") or ""
    return f"{first} {last}".strip() or "Unknown Patient"


def _initials(patient: dict[str, Any]) -> str:
    first = (patient.get("preferred_name") or patient.get("first_name") or "")[:1]
    last = (patient.get("last_name") or "")[:1]
    return (first + last).upper() or "PT"


def _appointments_with_patient(
    admin: Any, provider_id: str, patient_id: str
) -> list[dict[str, Any]]:
    """All appointments between this provider and this patient, newest first.

    Appointment date/time live on the joined provider_availability row."""
    try:
        resp = (
            admin.table("appointments")
            .select(
                "id, status, notes, "
                "provider_availability (available_date, available_time)"
            )
            .eq("patient_id", patient_id)
            .eq("provider_id", provider_id)
            .execute()
        )
        appointments = []
        for appt in resp.data or []:
            availability = appt.get("provider_availability") or {}
            appointments.append(
                {
                    "id": appt.get("id"),
                    "date": availability.get("available_date"),
                    "time": availability.get("available_time"),
                    "status": appt.get("status"),
                    "visitType": appt.get("notes") or "Visit",
                }
            )
        appointments.sort(
            key=lambda a: (a.get("date") or "", a.get("time") or ""),
            reverse=True,
        )
        return appointments
    except Exception:
        return []


def get_patient_overview(provider_id: str, patient_id: str) -> dict[str, Any]:
    """Chart payload for one patient, opened from Quick Patient Lookup.

    Same shape as the visit-overview detail payload so the frontend
    full-chart view can render it, but keyed by patient instead of
    appointment."""
    require_active_relationship(provider_id, patient_id)

    admin = get_supabase_admin()
    resp = (
        admin.table("patients")
        .select(
            "id, user_id, first_name, last_name, preferred_name, mrn, date_of_birth"
        )
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
    appointments = _appointments_with_patient(admin, provider_id, patient_id)

    return {
        "patient": {
            "id": patient.get("id"),
            "userId": patient.get("user_id"),
            "name": _full_name(patient),
            "initials": _initials(patient),
            "mrn": patient.get("mrn"),
            "dateOfBirth": patient.get("date_of_birth"),
        },
        "appointment": appointments[0] if appointments else None,
        "appointments": appointments,
        **build_patient_sections(admin, patient_id),
    }


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
