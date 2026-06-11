# AI-USAGE SUMMARY
# Tools: Claude Code (Opus 4.8)
# Overall AI Contribution: ~80%
# AI-Assisted Areas: Provider-scoped scheduling routes (availability list/add/
#   delete, the provider's patients, appointments list, and provider-initiated
#   booking), all gated by current_provider_id.
# Human Contributions: Reviewed the auth wiring and response models.
# Notes: Validated via pytest.
from fastapi import APIRouter, Depends, status

from auth.deps import current_provider_id
from .schemas import (
    AvailabilityCreate,
    AvailabilitySlotOut,
    SchedulePatientOut,
    ProviderAppointmentCreate,
    ProviderAppointmentOut,
    RecurrenceRuleCreate,
    RecurrenceRuleOut,
    SlotStateUpdate,
)
from . import service

router = APIRouter(prefix="/schedule", tags=["scheduling"])


@router.get("/availability", response_model=list[AvailabilitySlotOut])
def list_availability(provider_id: str = Depends(current_provider_id)):
    return service.get_availability(provider_id)


@router.post(
    "/availability",
    response_model=list[AvailabilitySlotOut],
    status_code=status.HTTP_201_CREATED,
)
def add_availability(
    payload: AvailabilityCreate,
    provider_id: str = Depends(current_provider_id),
):
    return service.add_availability(provider_id, payload)


@router.delete("/availability/{slot_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_availability(
    slot_id: str,
    provider_id: str = Depends(current_provider_id),
):
    service.delete_availability(provider_id, slot_id)


@router.post("/slot", response_model=AvailabilitySlotOut)
def set_slot(
    payload: SlotStateUpdate,
    provider_id: str = Depends(current_provider_id),
):
    """Open or block a single slot (calendar override of office hours)."""
    return service.set_slot_state(
        provider_id, payload.date, payload.time, payload.state
    )


@router.get("/rules", response_model=list[RecurrenceRuleOut])
def list_rules(provider_id: str = Depends(current_provider_id)):
    return service.get_recurrence_rules(provider_id)


@router.post(
    "/rules",
    response_model=list[RecurrenceRuleOut],
    status_code=status.HTTP_201_CREATED,
)
def add_rule(
    payload: RecurrenceRuleCreate,
    provider_id: str = Depends(current_provider_id),
):
    return service.add_recurrence_rule(provider_id, payload)


@router.delete("/rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_rule(rule_id: str, provider_id: str = Depends(current_provider_id)):
    service.delete_recurrence_rule(provider_id, rule_id)


@router.get("/patients", response_model=list[SchedulePatientOut])
def list_patients(provider_id: str = Depends(current_provider_id)):
    return service.get_patients(provider_id)


@router.get("/appointments", response_model=list[ProviderAppointmentOut])
def list_appointments(provider_id: str = Depends(current_provider_id)):
    return service.get_appointments(provider_id)


@router.post(
    "/appointments",
    response_model=ProviderAppointmentOut,
    status_code=status.HTTP_201_CREATED,
)
def create_appointment(
    payload: ProviderAppointmentCreate,
    provider_id: str = Depends(current_provider_id),
):
    return service.create_appointment(provider_id, payload)


@router.post(
    "/appointments/{appointment_id}/cancel",
    status_code=status.HTTP_204_NO_CONTENT,
)
def cancel_appointment(
    appointment_id: str,
    provider_id: str = Depends(current_provider_id),
):
    service.cancel_appointment(provider_id, appointment_id)
