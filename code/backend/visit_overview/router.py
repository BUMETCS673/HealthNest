"""
AI-USAGE SUMMARY
Tools: ChatGPT
Overall AI Contribution: ~65%
AI-Assisted Areas: Helped draft the provider visit overview API route and
connect it to the service layer.
Human Contributions: Verified route naming, project structure, and how the
endpoint fits SCRUM-58 requirements.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from auth.deps import current_provider

from . import service
from .schemas import VisitOverviewOut


router = APIRouter(prefix="/providers", tags=["visit overview"])


@router.get("/visit-overviews")
def list_visit_overviews(
    provider: dict[str, Any] = Depends(current_provider),
) -> list[dict[str, Any]]:
    return service.get_provider_visit_overviews(provider["id"])


@router.get(
    "/visit-overview/{appointment_id}",
    response_model=VisitOverviewOut,
)
def get_visit_overview(
    appointment_id: str,
    provider: dict[str, Any] = Depends(current_provider),
) -> VisitOverviewOut:
    visit_overview = service.build_visit_overview(
        provider_id=provider["id"],
        appointment_id=appointment_id,
    )

    return VisitOverviewOut(**visit_overview)