from pydantic import BaseModel, Field


class AppointmentCreate(BaseModel):
    provider_name: str
    specialty: str | None = None
    location: str | None = None
    appointment_date: str  # YYYY-MM-DD
    appointment_time: str  # HH:MM
    notes: str | None = None


class AppointmentUpdate(BaseModel):
    appointment_date: str | None = None
    appointment_time: str | None = None
    status: str | None = Field(default=None, pattern="^(scheduled|cancelled|completed|rescheduled)$")
    notes: str | None = None


class AppointmentOut(BaseModel):
    id: str
    patient_id: str
    provider_name: str
    specialty: str | None = None
    location: str | None = None
    appointment_date: str
    appointment_time: str
    status: str
    notes: str | None = None
    created_at: str | None = None


class AvailabilitySlot(BaseModel):
    id: str
    provider_name: str
    specialty: str | None = None
    location: str | None = None
    available_date: str
    available_time: str
    is_booked: bool
