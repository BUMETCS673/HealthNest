# AI-USAGE SUMMARY 
# Tools: Claude Code
# Overall AI Contribution: ~60% 
# AI-Assisted Areas: Implementing the service layer for appointments, including functions to get, create, update, and cancel appointments.
# Human Contributions: Defining the business logic for each function, ensuring they fit with our application's requirements, 
# and integrating them with the router and schemas.
# Notes: AI was used to help quickly set up the basic structure of our service layer and to implement the core functions for managing appointments.


from typing import Any

from fastapi import HTTPException, status

from auth.client import get_supabase_admin
from .schemas import AppointmentCreate, AppointmentNotesUpdate, AppointmentReschedule
from datetime import datetime



# AI-ASSISTED: YES 
# Tool: Claude Code
# Prompt Summary: "Could you help me implement these actions for appointments in out application: Book new appointment, 
# View/list appointments, Cancel or reschedule, Provider availability/slots" 
# AI Contribution: ~40%
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


def _get_availability_slot(availability_id: str) -> dict[str, Any]:
    availability = (
        get_supabase_admin()
        .table("provider_availability")
        .select("*")
        .eq("id", availability_id)
        .single()
        .execute()
    )

    if not availability.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Availability slot not found.",
        )

    return availability.data


def _verify_appointment(appointment: dict[str, Any]) -> None:
    if appointment["status"] == "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Completed appointments cannot be modified."
        )
    
    if appointment["status"] == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cancelled appointments cannot be modified.",
        )

def _get_appointment(appointment_id: str, patient_id: str) -> dict[str, Any]:
    appointment = (
        get_supabase_admin()
        .table("appointments")
        .select("*")
        .eq("id", appointment_id)
        .eq("patient_id", patient_id)
        .single()
        .execute()
    )

    if not appointment.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Appointment not found.",
        )
    
    return appointment.data

def _get_modifiable_appointment(appointment_id: str, patient_id: str) -> dict[str, Any]:
    appointment = _get_appointment(appointment_id, patient_id)
    _verify_appointment(appointment)
    return appointment





# ── Appointments ─────────────────────────────────────────────
def get_appointments(patient_id: str) -> list[dict[str, Any]]:
    result = (
        get_supabase_admin()
        .table("appointments")
        .select("""
            *,
            providers (
                user_id,
                title,
                first_name,
                last_name,
                specialty
            ),
            provider_availability (
                available_date,
                available_time
            )
        """)
        .eq("patient_id", patient_id)
        .order(
            "available_date",
            desc=False,
            foreign_table="provider_availability"
        )
        .order(
            "available_time",
            desc=False,
            foreign_table="provider_availability"
        )
        .execute()
    )

    return [_clean(a) for a in result.data]



# AI-ASSISTED: YES 
# Tool: Claude Code
# Prompt Summary: "Could you help me implement these actions for appointments in out application: Book new appointment, 
# View/list appointments, Cancel or reschedule, Provider availability/slots" 
# AI Contribution: ~40%
# Modifications: 
# - Provided buysiness logic and made adjustments to ensure it fits our application's needs. 
# - Integrated it with the other parts of the application.
# Verification: 
# - So far, I've reviewed the coded and tested the actions manually. I also used out CI/CD pipeline to run automated tests 
# to verify that the endpoints are working as expected.
# Confidence: High. All of the code has been reviewed and tested. 
def create_appointment(patient_id: str, payload: AppointmentCreate) -> dict[str, Any]:
    availability_slot = _get_availability_slot(payload.availability_id)

    if availability_slot["provider_id"] != payload.provider_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provider does not match availability slot.",
        )

    if availability_slot["is_booked"]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Appointment slot is already booked.",
        )

    slot_dt = datetime.fromisoformat(
        f"{availability_slot['available_date']}T{availability_slot['available_time']}"
    )
    if slot_dt < datetime.now():
        raise HTTPException(status_code=400, detail="Cannot book a slot in the past.")
    
    data = {
        "patient_id": patient_id,
        "provider_id": payload.provider_id,
        "availability_id": payload.availability_id,
        "notes": payload.notes,
        "status": "scheduled",
    }

    result = (
        get_supabase_admin()
        .table("appointments")
        .insert(data)
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create appointment.",
        )

    # Update provider availability to booked
    (
        get_supabase_admin()
        .table("provider_availability")
        .update({"is_booked": True})
        .eq("id", payload.availability_id)
        .execute()
    )

    # Initialize patient-provider relationship if not exists
    (
        get_supabase_admin()
        .table("patient_provider_relationships")
        .upsert(
            {
                "patient_id": patient_id,
                "provider_id": payload.provider_id,
                "relationship": "primary_care",
                "status": "active",
            },
            on_conflict="patient_id,provider_id",
        )
        .execute()
    )

    return _clean(result.data[0])

    


# AI-ASSISTED: YES 
# Tool: Claude Code
# Prompt Summary: "Could you help me implement these actions for appointments in out application: Book new appointment, 
# View/list appointments, Cancel or reschedule, Provider availability/slots" 
# AI Contribution: ~40% 
# Modifications: 
# - Provided buysiness logic and made adjustments to ensure it fits our application's needs. 
# - Integrated it with the other parts of the application.
# Verification: 
# - So far, I've reviewed the coded and tested the actions manually. I also used out CI/CD pipeline to run automated tests 
# to verify that the endpoints are working as expected.
# Confidence: High. All of the code has been reviewed and tested. 
def edit_appointment_notes(
    appointment_id: str, patient_id: str, payload: AppointmentNotesUpdate) -> dict[str, Any]:
    # Verify ownership
    _get_modifiable_appointment(appointment_id, patient_id)

    result = (
        get_supabase_admin()
        .table("appointments")
        .update({"notes": payload.notes})
        .eq("id", appointment_id)
        .execute()
    )
    return _clean(result.data[0])



def reschedule_appointment(
    appointment_id: str,
    patient_id: str,
    payload: AppointmentReschedule,
) -> dict[str, Any]:

    # Verify appointment ownership
    appointment = _get_modifiable_appointment(appointment_id, patient_id)

    # Verify new slot exists
    new_slot = _get_availability_slot(payload.availability_id)

    old_slot_id = appointment["availability_id"]

    # If the same slot is being requested, treat as no-op
    if payload.availability_id == old_slot_id:
        return _clean(appointment)

    # Verify slot is available
    if new_slot["is_booked"]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Appointment slot is already booked.",
        )
    
    # Force same-provider rescheduling
    if new_slot["provider_id"] != appointment["provider_id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot reschedule to a different provider.",
        )

    # Unbook old slot
    (
        get_supabase_admin()
        .table("provider_availability")
        .update({"is_booked": False})
        .eq("id", old_slot_id)
        .execute()
    )

    # Book new slot
    (
        get_supabase_admin()
        .table("provider_availability")
        .update({"is_booked": True})
        .eq("id", payload.availability_id)
        .execute()
    )

    # Update appointment
    result = (
        get_supabase_admin()
        .table("appointments")
        .update(
            {
                "availability_id": payload.availability_id,
            }
        )
        .eq("id", appointment_id)
        .execute()
    )

    return _clean(result.data[0])




# AI-ASSISTED: YES 
# Tool: Claude Code
# Prompt Summary: "Could you help me implement these actions for appointments in out application: Book new appointment, 
# View/list appointments, Cancel or reschedule, Provider availability/slots" 
# AI Contribution: ~40% 
# Modifications: 
# - Provided buysiness logic and made adjustments to ensure it fits our application's needs. 
# - Integrated it with the other parts of the application.
# Verification: 
# - So far, I've reviewed the coded and tested the actions manually. I also used out CI/CD pipeline to run automated tests 
# to verify that the endpoints are working as expected.
# Confidence: High. All of the code has been reviewed and tested. 
def cancel_appointment(appointment_id: str, patient_id: str) -> None:
    appointment = _get_modifiable_appointment(appointment_id, patient_id)

    # Hard-delete the appointment (it FKs the slot, so remove it first), then
    # free the slot for booking again. Hard-deleting — rather than leaving a
    # 'cancelled' row that still references the slot — keeps the data model
    # consistent with the provider cancel and avoids fk_appointments_availability
    # violations when that slot is later cleaned up.
    (
        get_supabase_admin()
        .table("appointments")
        .delete()
        .eq("id", appointment_id)
        .execute()
    )

    # Free up provider availability
    (
        get_supabase_admin()
        .table("provider_availability")
        .update({"is_booked": False})
        .eq("id", appointment["availability_id"])
        .execute()
    )



# AI-ASSISTED: YES 
# Tool: Claude Code
# Prompt Summary: "Could you help me implement these actions for appointments in out application: Book new appointment, 
# View/list appointments, Cancel or reschedule, Provider availability/slots" 
# AI Contribution: ~40% 
# Modifications: 
# - Provided buysiness logic and made adjustments to ensure it fits our application's needs. 
# - Integrated it with the other parts of the application.
# Verification: 
# - So far, I've reviewed the coded and tested the actions manually. I also used out CI/CD pipeline to run automated tests 
# to verify that the endpoints are working as expected.
# Confidence: High. All of the code has been reviewed and tested. 

# ── Provider Availability ────────────────────────────────────
def get_availability() -> list[dict[str, Any]]:
    now = datetime.now()
    today_iso = now.date().isoformat()
    now_time = now.strftime("%H:%M:%S")

    result = (
        get_supabase_admin()
        .table("provider_availability")
        .select("""
            *,
            providers ( title, first_name, last_name, specialty )
        """)
        .eq("is_booked", False)
        .eq("blocked", False)
        .gte("available_date", today_iso)
        .order("available_date", desc=False)
        .order("available_time", desc=False)
        .execute()
    )

    slots = [
        s for s in result.data
        if s["available_date"] > today_iso
        or (s["available_date"] == today_iso and s["available_time"] > now_time)
    ]

    return [
        {**s, "available_time": _normalize_time(s["available_time"])}
        for s in slots
    ]
