from fastapi import APIRouter, Depends, status

from deps import current_user_id
from .schemas import AppointmentCreate, AppointmentOut, AppointmentUpdate, AvailabilitySlot
from . import service

router = APIRouter(prefix="/appointments", tags=["appointments"])


# ── Availability (must be declared before /{appointment_id}) ──

@router.get("/availability", response_model=list[AvailabilitySlot])
def list_availability():
    """Return all unbooked provider slots."""
    return service.get_availability()


# ── Appointments CRUD ─────────────────────────────────────────

@router.get("/", response_model=list[AppointmentOut])
def list_appointments(patient_id: str = Depends(current_user_id)):
    """List all appointments for the authenticated patient."""
    return service.get_appointments(patient_id)


@router.post("/", response_model=AppointmentOut, status_code=status.HTTP_201_CREATED)
def create_appointment(
    payload: AppointmentCreate,
    patient_id: str = Depends(current_user_id),
):
    """Book a new appointment."""
    return service.create_appointment(patient_id, payload)


@router.patch("/{appointment_id}", response_model=AppointmentOut)
def update_appointment(
    appointment_id: str,
    payload: AppointmentUpdate,
    patient_id: str = Depends(current_user_id),
):
    """Reschedule or update notes on an appointment."""
    return service.update_appointment(appointment_id, patient_id, payload)


@router.delete("/{appointment_id}", status_code=status.HTTP_204_NO_CONTENT)
def cancel_appointment(
    appointment_id: str,
    patient_id: str = Depends(current_user_id),
):
    """Soft-cancel an appointment (sets status → 'cancelled')."""
    service.cancel_appointment(appointment_id, patient_id)
