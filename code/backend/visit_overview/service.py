"""
AI-USAGE SUMMARY
Tools: ChatGPT
Overall AI Contribution: ~60%
AI-Assisted Areas: Helped draft the service logic for collecting appointment,
patient, lab, and missing-section data for the provider visit overview.
Human Contributions: Reviewed database assumptions, adjusted logic to fit
available backend tables, and tested the endpoint locally.
"""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException, status

from auth.client import get_supabase_admin
from auth.deps import require_active_relationship


def _normalize_time(time_value: str | None) -> str | None:
    if not time_value:
        return None

    return ":".join(str(time_value).split(":")[:2])


def _get_full_name(patient: dict[str, Any]) -> str:
    first_name = patient.get("preferred_name") or patient.get("first_name") or ""
    last_name = patient.get("last_name") or ""

    full_name = f"{first_name} {last_name}".strip()

    if full_name:
        return full_name

    return "Unknown Patient"


def _get_initials(patient: dict[str, Any]) -> str:
    first_name = patient.get("first_name") or ""
    last_name = patient.get("last_name") or ""

    initials = ""

    if first_name:
        initials += first_name[0]

    if last_name:
        initials += last_name[0]

    if initials:
        return initials.upper()

    return "PT"


def _get_appointment(appointment_id: str) -> dict[str, Any]:
    result = (
        get_supabase_admin()
        .table("appointments")
        .select("*")
        .eq("id", appointment_id)
        .limit(1)
        .execute()
    )

    appointments = result.data or []

    if not appointments:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Appointment not found.",
        )

    return appointments[0]


def _get_patient(patient_id: str) -> dict[str, Any]:
    result = (
        get_supabase_admin()
        .table("patients")
        .select("id, user_id, first_name, last_name, preferred_name, mrn, date_of_birth")
        .eq("id", patient_id)
        .is_("deleted_at", None)
        .limit(1)
        .execute()
    )

    patients = result.data or []

    if patients:
        return patients[0]

    result = (
        get_supabase_admin()
        .table("patients")
        .select("id, user_id, first_name, last_name, preferred_name, mrn, date_of_birth")
        .eq("user_id", patient_id)
        .is_("deleted_at", None)
        .limit(1)
        .execute()
    )

    patients = result.data or []

    if not patients:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found.",
        )

    return patients[0]


def _get_labs(patient_id: str) -> list[dict[str, Any]]:
    result = (
        get_supabase_admin()
        .table("lab_results")
        .select("id, lab_name, status, collected_at, resulted_at")
        .eq("patient_id", patient_id)
        .is_("deleted_at", None)
        .order("resulted_at", desc=True)
        .limit(5)
        .execute()
    )

    return result.data or []


def build_visit_overview(provider_id: str, appointment_id: str) -> dict[str, Any]:
    appointment = _get_appointment(appointment_id)
    patient_id = appointment.get("patient_id")

    if not patient_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Appointment is missing a patient.",
        )

    patient = _get_patient(patient_id)
    resolved_patient_id = patient.get("id")

    require_active_relationship(provider_id, resolved_patient_id)

    labs = _get_labs(resolved_patient_id)
    patient_name = _get_full_name(patient)

    lab_items = []
    for lab in labs:
        lab_items.append(
            {
                "test": lab.get("lab_name") or "Lab Result",
                "result": "Available",
                "date": lab.get("resulted_at") or lab.get("collected_at"),
                "status": lab.get("status"),
            }
        )

    missing_sections = []

    if not labs:
        missing_sections.append("Lab information unavailable")

    missing_sections.append("Medication information unavailable")
    missing_sections.append("Active problem list unavailable")
    missing_sections.append("Allergy information unavailable")

    open_issues = []

    if not labs:
        open_issues.append(
            {
                "level": "Medium",
                "tone": "medium",
                "text": "No recent lab results were found for this patient.",
            }
        )

    summary = (
        f"{patient_name} has an appointment scheduled for "
        f"{appointment.get('appointment_date')} at "
        f"{_normalize_time(appointment.get('appointment_time'))}."
    )

    if labs:
        summary += f" {len(labs)} recent lab result(s) are available for review."
    else:
        summary += " No recent lab results were found."

    return {
        "patient": {
            "id": patient.get("id"),
            "name": patient_name,
            "initials": _get_initials(patient),
            "mrn": patient.get("mrn"),
            "dateOfBirth": patient.get("date_of_birth"),
        },
        "appointment": {
            "id": appointment.get("id"),
            "time": _normalize_time(appointment.get("appointment_time")),
            "date": appointment.get("appointment_date"),
            "visitType": appointment.get("notes") or "Visit Overview",
            "status": appointment.get("status"),
        },
        "generatedFrom": "Generated from available appointment, patient, and lab records",
        "summary": summary,
        "recentHistory": [
            {
                "date": appointment.get("appointment_date"),
                "provider": appointment.get("provider_name"),
                "title": appointment.get("notes") or "Scheduled visit",
                "detail": f"Appointment status: {appointment.get('status') or 'scheduled'}.",
            }
        ],
        "activeProblems": [],
        "medications": [],
        "labs": lab_items,
        "openIssues": open_issues,
        "missingSections": missing_sections,
    }


def get_provider_visit_overviews(provider_id: str) -> list[dict[str, Any]]:
    result = (
        get_supabase_admin()
        .table("appointments")
        .select("*")
        .order("appointment_date", desc=False)
        .order("appointment_time", desc=False)
        .limit(10)
        .execute()
    )

    appointments = result.data or []
    overview_items = []

    for appointment in appointments:
        patient_id = appointment.get("patient_id")
        patient_name = "Unknown Patient"
        patient_initials = "PT"

        if patient_id:
            try:
                patient = _get_patient(patient_id)
                patient_name = _get_full_name(patient)
                patient_initials = _get_initials(patient)
            except Exception:
                patient_name = appointment.get("patient_name") or "Unknown Patient"
                patient_initials = "PT"

        overview_items.append(
            {
                "id": appointment.get("id"),
                "patientId": patient_id,
                "name": patient_name,
                "initials": patient_initials,
                "time": _normalize_time(appointment.get("appointment_time")),
                "date": appointment.get("appointment_date"),
                "type": appointment.get("notes") or "Visit Overview",
                "status": appointment.get("status"),
            }
        )

    return overview_items