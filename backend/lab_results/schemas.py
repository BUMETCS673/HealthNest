"""
AI-USAGE SUMMARY
Tools: Opus 4.7
Overall AI Contribution: ~70%
AI-Assisted Areas: Translated the DB column definitions into Pydantic models for the request/response surface (LabResultOut, LabResultSummary, entry/patch shapes, SignedFileUrl).
Human Contributions: Decided what is exposed to patients vs. providers (notes/parse_error stripped on patient reads), the optional-vs-required field choices, and the patch payload structure for partial updates.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


SourceFormat = Literal["hl7v2", "json", "xml"]
LabResultStatus = Literal["uploaded", "reviewed", "released", "archived"]
AbnormalFlag = Literal[
    "normal", "low", "high", "critical_low", "critical_high", "abnormal"
]


class LabResultEntryOut(BaseModel):
    id: str
    loinc_code: str | None = None
    component_name: str
    value: str | None = None  # decrypted on read
    value_numeric: float | None = None
    unit: str | None = None
    reference_range: str | None = None
    abnormal_flag: AbnormalFlag = "normal"
    needs_manual_entry: bool = False
    display_order: int = 0


class LabResultOut(BaseModel):
    id: str
    patient_id: str
    provider_id: str
    diagnostic_order_id: str | None = None
    storage_path: str
    source_format: SourceFormat
    status: LabResultStatus
    lab_name: str
    ordering_provider_name: str | None = None
    collected_at: datetime | None = None
    resulted_at: datetime | None = None
    released_at: datetime | None = None
    released_by: str | None = None
    parser_version: str
    parse_error: str | None = None
    notes: str | None = None  # decrypted
    created_at: datetime
    updated_at: datetime
    entries: list[LabResultEntryOut] = []


class LabResultSummary(BaseModel):

    id: str
    patient_id: str
    provider_id: str
    source_format: SourceFormat
    status: LabResultStatus
    lab_name: str
    collected_at: datetime | None = None
    resulted_at: datetime | None = None
    released_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class LabResultEntryPatch(BaseModel):

    id: str | None = None  # if absent, treat as a new entry
    loinc_code: str | None = None
    component_name: str | None = None
    value: str | None = None
    value_numeric: float | None = None
    unit: str | None = None
    reference_range: str | None = None
    abnormal_flag: AbnormalFlag | None = None
    needs_manual_entry: bool | None = None
    display_order: int | None = None


class LabResultPatch(BaseModel):
    lab_name: str | None = None
    ordering_provider_name: str | None = None
    collected_at: datetime | None = None
    resulted_at: datetime | None = None
    notes: str | None = None
    entries: list[LabResultEntryPatch] | None = None
    transition_to_reviewed: bool = Field(
        default=False,
        description="If true and current status is 'uploaded', advance to 'reviewed'.",
    )


class SignedFileUrl(BaseModel):
    url: str
    expires_in_seconds: int
