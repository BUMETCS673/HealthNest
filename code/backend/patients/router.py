"""
AI-USAGE SUMMARY
Tools: Opus 4.7
Overall AI Contribution: ~60%
AI-Assisted Areas: Wrote the FastAPI route handlers for GET /patients (typeahead search) and GET /patients/{id} (resolution by ID), including Depends injection and response_model wiring.
Human Contributions: Decided the endpoint is provider-only (patients should not enumerate other patients), set the limit clamp at 1-100, and chose to surface 404 vs 403 on the get-by-id path.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from auth.deps import current_provider

from . import service
from .schemas import PatientSummary


router = APIRouter(prefix="/patients", tags=["patients"])


@router.get("", response_model=list[PatientSummary])
def list_patients(
    q: str | None = None,
    limit: int = 20,
    provider: dict[str, Any] = Depends(current_provider),
) -> list[PatientSummary]:
    limit = max(1, min(limit, 100))
    rows = service.search(provider_id=provider["id"], q=q, limit=limit)
    return [PatientSummary(**r) for r in rows]


@router.get("/{patient_id}", response_model=PatientSummary)
def get_patient(
    patient_id: str,
    provider: dict[str, Any] = Depends(current_provider),
) -> PatientSummary:
    return PatientSummary(
        **service.get_one(provider_id=provider["id"], patient_id=patient_id)
    )
