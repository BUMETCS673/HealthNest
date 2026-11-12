"""
AI-USAGE SUMMARY
Tools: Opus 4.7
Overall AI Contribution: ~55%
AI-Assisted Areas: Translated the patients table columns into a PatientSummary Pydantic model with appropriate optional/required typing.
Human Contributions: Decided which non-PHI columns are safe to expose to the frontend (id, first_name, last_name, preferred_name, mrn, dob) and explicitly excluded every *_enc column from the response surface.
"""

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
