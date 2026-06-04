# AI-USAGE SUMMARY 
# Tools: Claude Code
# Overall AI Contribution: ~80% 
# AI-Assisted Areas: Setting up the router, defining CRUD operations/endpoints. 
# Human Contributions: Business logic and validation.
# Notes: I verified that the router was configured correctly. I may modify it in future iterations, I just used AI to help me quickly set up
# our prototype application. 

from fastapi import APIRouter, Depends, status

from deps import current_user_id
from .schemas import AppointmentCreate, AppointmentOut, AppointmentNotesUpdate, AvailabilitySlot, AppointmentReschedule
from . import service

router = APIRouter(prefix="/appointments", tags=["appointments"])




@router.get("/availability", response_model=list[AvailabilitySlot])
def get_availability():
    """Return all unbooked provider slots."""
    return service.get_availability()



@router.get("/", response_model=list[AppointmentOut])
def get_appointments(patient_id: str = Depends(current_user_id)):
    """List all appointments for the authenticated patient."""
    return service.get_appointments(patient_id)



@router.post("/", response_model=AppointmentOut, status_code=status.HTTP_201_CREATED)
def create_appointment(
    payload: AppointmentCreate,
    patient_id: str = Depends(current_user_id),
):
    """Book a new appointment."""
    return service.create_appointment(patient_id, payload)



@router.patch("/{appointment_id}/edit_notes", response_model=AppointmentOut)
def edit_appointment_notes(
    appointment_id: str,
    payload: AppointmentNotesUpdate,
    patient_id: str = Depends(current_user_id),
):
    """Update notes on an appointment."""
    return service.edit_appointment_notes(appointment_id, patient_id, payload)


@router.post("/{appointment_id}/reschedule", response_model=AppointmentOut)
def reschedule_appointment(
    appointment_id: str,
    payload: AppointmentReschedule,
    patient_id: str = Depends(current_user_id),
):
    return service.reschedule_appointment(
        appointment_id,
        patient_id,
        payload,
    )



@router.post("/{appointment_id}/cancel", status_code=status.HTTP_204_NO_CONTENT)
def cancel_appointment(
    appointment_id: str,
    patient_id: str = Depends(current_user_id),
):
    """Soft-cancel an appointment (sets status → 'cancelled')."""
    service.cancel_appointment(appointment_id, patient_id)
