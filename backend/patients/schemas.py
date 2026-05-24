from __future__ import annotations

from datetime import date

from pydantic import BaseModel


class PatientSummary(BaseModel):
    id: str
    first_name: str
    last_name: str
    preferred_name: str | None = None
    mrn: str | None = None
    date_of_birth: date | None = None
