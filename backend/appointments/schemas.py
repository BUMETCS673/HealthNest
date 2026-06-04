# AI-USAGE SUMMARY 
# Tools: Claude Code
# Overall AI Contribution: ~30% 
# AI-Assisted Areas: Setting up the schemas for appointments, including defining the data models for creating, updating, 
# and viewing appointments and availability slots.
# Human Contributions: Defining the specific fields and validation rules for the appointment data models, ensuring they fit our application's needs.
# Notes: We reviewed the generated schemas and made adjustments to ensure they align with our application's requirements. 
# We also helped integrate these schemas with the routers and service layers of our application.

from pydantic import BaseModel
from enum import Enum


class AppointmentStatus(str, Enum):
    PENDING = "pending"
    SCHEDULED = "scheduled"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"

class AppointmentCreate(BaseModel):
    provider_id: str
    availability_id: str
    notes: str | None = None


class AppointmentNotesUpdate(BaseModel):
    notes: str | None = None


class AppointmentReschedule(BaseModel):
    availability_id: str


class AppointmentOut(BaseModel):
    id: str
    patient_id: str
    provider_id: str
    availability_id: str
    status: AppointmentStatus
    notes: str | None = None
    created_at: str | None = None
    updated_at: str | None = None

class ProviderSummary(BaseModel):
    first_name: str
    last_name: str
    specialty: str

class AvailabilitySlot(BaseModel):
    id: str
    provider_id: str
    available_date: str
    available_time: str
    created_at: str | None = None
    is_booked: bool
    provider: ProviderSummary
