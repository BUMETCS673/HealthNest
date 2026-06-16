# AI-USAGE SUMMARY
# Tools: Claude Code (Opus 4.8)
# Overall AI Contribution: ~70%
# AI-Assisted Areas: Pydantic models for provider scheduling — availability
#   creation (single day or weekday recurrence), slot output, the provider's
#   patients, and provider-initiated appointment create/out.
# Human Contributions: Field/validation choices and the recurrence contract.
# Notes: Validated via pytest.
from pydantic import BaseModel


class AvailabilityCreate(BaseModel):
    start_date: str            # YYYY-MM-DD
    start_time: str            # HH:MM (inclusive)
    end_time: str              # HH:MM (exclusive)
    weekdays: list[int] = []   # 0=Mon .. 6=Sun; empty => just start_date
    end_date: str | None = None  # inclusive window end (required when weekdays given)


class AvailabilitySlotOut(BaseModel):
    id: str
    available_date: str
    available_time: str
    is_booked: bool
    blocked: bool = False


class SlotStateUpdate(BaseModel):
    date: str                  # YYYY-MM-DD
    time: str                  # HH:MM
    state: str                 # "open" | "blocked"


class SchedulePatientOut(BaseModel):
    id: str
    first_name: str
    last_name: str


class RecurrenceRuleCreate(BaseModel):
    weekdays: list[int]            # 0=Mon .. 6=Sun (one rule row per weekday)
    start_time: str               # HH:MM
    end_time: str                 # HH:MM
    effective_from: str | None = None    # YYYY-MM-DD, default today
    effective_until: str | None = None   # YYYY-MM-DD, None = indefinite


class RecurrenceRuleOut(BaseModel):
    id: str
    weekday: int
    start_time: str
    end_time: str
    effective_from: str
    effective_until: str | None = None
    active: bool


class ProviderAppointmentCreate(BaseModel):
    patient_id: str
    date: str                  # YYYY-MM-DD
    time: str                  # HH:MM
    notes: str | None = None


class ProviderAppointmentOut(BaseModel):
    id: str
    patient_id: str
    patient_user_id: str | None = None
    patient_name: str | None = None
    availability_id: str
    status: str
    notes: str | None = None
    available_date: str | None = None
    available_time: str | None = None
