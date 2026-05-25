# AI-USAGE SUMMARY 
# Tools: Claude Code
# Overall AI Contribution: ~60% 
# AI-Assisted Areas: Implementing the service layer for appointments, including functions to get, create, update, and cancel appointments.
# Human Contributions: Defining the business logic for each function, ensuring they fit with our application's requirements, 
# and integrating them with the router and schemas.
# Notes: AI was used to help quickly set up the basic structure of our service layer and to implement the core functions for managing appointments.


from typing import Any

from fastapi import HTTPException, status

from auth.client import get_supabase
from .schemas import AppointmentCreate, AppointmentUpdate



# AI-ASSISTED: YES 
# Tool: Claude Code
# Prompt Summary: "Could you help me implement these actions for appointments in out application: Book new appointment, 
# View/list appointments, Cancel or reschedule, Provider availability/slots" 
# AI Contribution: Initial draft (~60%) 
# Modifications: 
# - Provided buysiness logic and made adjustments to ensure it fits our application's needs. 
# - Integrated it with the other parts of the application.
# Verification: 
# - So far, I've reviewed the coded and tested the actions manually. I also used out CI/CD pipeline to run automated tests 
# to verify that the endpoints are working as expected.
# Confidence: High. All of the code has been reviewed and tested. 
# This note applies to get_appointments and the helper functions.


# ── Helpers ─────────────────────────────────────────────────
def _normalize_time(t: str) -> str:
    """Trim seconds from 'HH:MM:SS' → 'HH:MM'."""
    return ":".join(t.split(":")[:2])


def _clean(appt: dict) -> dict:
    if "appointment_time" in appt and appt["appointment_time"]:
        appt["appointment_time"] = _normalize_time(appt["appointment_time"])
    return appt


# ── Appointments ─────────────────────────────────────────────
def get_appointments(patient_id: str) -> list[dict[str, Any]]:
    result = (
        get_supabase()
        .table("appointments")
        .select("*")
        .eq("patient_id", patient_id)
        .order("appointment_date", desc=False)
        .order("appointment_time", desc=False)
        .execute()
    )
    return [_clean(a) for a in result.data]



# AI-ASSISTED: YES 
# Tool: Claude Code
# Prompt Summary: "Could you help me implement these actions for appointments in out application: Book new appointment, 
# View/list appointments, Cancel or reschedule, Provider availability/slots" 
# AI Contribution: Initial draft (~60%) 
# Modifications: 
# - Provided buysiness logic and made adjustments to ensure it fits our application's needs. 
# - Integrated it with the other parts of the application.
# Verification: 
# - So far, I've reviewed the coded and tested the actions manually. I also used out CI/CD pipeline to run automated tests 
# to verify that the endpoints are working as expected.
# Confidence: High. All of the code has been reviewed and tested. 
def create_appointment(patient_id: str, payload: AppointmentCreate) -> dict[str, Any]:
    data = {
        "patient_id": patient_id,
        "provider_name": payload.provider_name,
        "specialty": payload.specialty,
        "location": payload.location,
        "appointment_date": payload.appointment_date,
        "appointment_time": payload.appointment_time,
        "notes": payload.notes,
        "status": "scheduled",
    }
    result = get_supabase().table("appointments").insert(data).execute()
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create appointment.",
        )

    # Mark the corresponding availability slot as booked
    get_supabase().table("provider_availability").update({"is_booked": True}).eq(
        "provider_name", payload.provider_name
    ).eq("available_date", payload.appointment_date).eq(
        "available_time", payload.appointment_time
    ).execute()

    return _clean(result.data[0])


# AI-ASSISTED: YES 
# Tool: Claude Code
# Prompt Summary: "Could you help me implement these actions for appointments in out application: Book new appointment, 
# View/list appointments, Cancel or reschedule, Provider availability/slots" 
# AI Contribution: Initial draft (~60%) 
# Modifications: 
# - Provided buysiness logic and made adjustments to ensure it fits our application's needs. 
# - Integrated it with the other parts of the application.
# Verification: 
# - So far, I've reviewed the coded and tested the actions manually. I also used out CI/CD pipeline to run automated tests 
# to verify that the endpoints are working as expected.
# Confidence: High. All of the code has been reviewed and tested. 
def update_appointment(
    appointment_id: str, patient_id: str, payload: AppointmentUpdate
) -> dict[str, Any]:
    # Verify ownership
    existing = (
        get_supabase()
        .table("appointments")
        .select("*")
        .eq("id", appointment_id)
        .eq("patient_id", patient_id)
        .execute()
    )
    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Appointment not found.",
        )

    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update_data:
        return _clean(existing.data[0])

    result = (
        get_supabase()
        .table("appointments")
        .update(update_data)
        .eq("id", appointment_id)
        .execute()
    )
    return _clean(result.data[0])



# AI-ASSISTED: YES 
# Tool: Claude Code
# Prompt Summary: "Could you help me implement these actions for appointments in out application: Book new appointment, 
# View/list appointments, Cancel or reschedule, Provider availability/slots" 
# AI Contribution: Initial draft (~60%) 
# Modifications: 
# - Provided buysiness logic and made adjustments to ensure it fits our application's needs. 
# - Integrated it with the other parts of the application.
# Verification: 
# - So far, I've reviewed the coded and tested the actions manually. I also used out CI/CD pipeline to run automated tests 
# to verify that the endpoints are working as expected.
# Confidence: High. All of the code has been reviewed and tested. 
def cancel_appointment(appointment_id: str, patient_id: str) -> None:
    existing = (
        get_supabase()
        .table("appointments")
        .select("id, status")
        .eq("id", appointment_id)
        .eq("patient_id", patient_id)
        .execute()
    )
    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Appointment not found.",
        )
    if existing.data[0]["status"] == "cancelled":
        return  # idempotent

    get_supabase().table("appointments").update({"status": "cancelled"}).eq(
        "id", appointment_id
    ).execute()



# AI-ASSISTED: YES 
# Tool: Claude Code
# Prompt Summary: "Could you help me implement these actions for appointments in out application: Book new appointment, 
# View/list appointments, Cancel or reschedule, Provider availability/slots" 
# AI Contribution: Initial draft (~60%) 
# Modifications: 
# - Provided buysiness logic and made adjustments to ensure it fits our application's needs. 
# - Integrated it with the other parts of the application.
# Verification: 
# - So far, I've reviewed the coded and tested the actions manually. I also used out CI/CD pipeline to run automated tests 
# to verify that the endpoints are working as expected.
# Confidence: High. All of the code has been reviewed and tested. 

# ── Provider Availability ────────────────────────────────────
def get_availability() -> list[dict[str, Any]]:
    result = (
        get_supabase()
        .table("provider_availability")
        .select("*")
        .eq("is_booked", False)
        .order("available_date", desc=False)
        .order("available_time", desc=False)
        .execute()
    )
    return [
        {**s, "available_time": _normalize_time(s["available_time"])}
        for s in result.data
    ]
