# AI-USAGE SUMMARY 
# Tools: Claude Code
# Overall AI Contribution: ~80% 
# AI-Assisted Areas: Setting up the router and a get providers endpoint.
# Human Contributions: Business logic and validation.
# Notes: I verified that the router was configured correctly. I may modify it in future iterations and add more functionality, 
# I just used AI to help me quickly set up our prototype application. 


from typing import Any
 
from fastapi import APIRouter, Depends, HTTPException, status
 
from auth.deps import current_provider, current_user
from .schemas import ProviderOut
from . import service
from ai.skills.visit_overview_skill import VisitOverviewSkill
from ai.skills.base import SkillContext
 
router = APIRouter(prefix="/providers", tags=["providers"])
 
_visit_overview_skill = VisitOverviewSkill()
 
 
@router.get("/", response_model=list[ProviderOut])
def list_providers():
    """Return all providers."""
    return service.get_providers()
 
 
@router.get("/visit-overviews")
def list_visit_overviews(
    provider: dict[str, Any] = Depends(current_provider),
    user: dict[str, Any] = Depends(current_user),
) -> list[dict[str, Any]]:
    
    """Return today's scheduled appointments for the authenticated provider."""
    ctx = SkillContext(
        patient_id=provider["id"],
        user_id=user["id"],
        conversation_id=None,
    )
    reply = _visit_overview_skill.run(ctx, op="list", appointment_id=None)
    payload = reply.payload or {}
    return payload.get("appointments", [])
 
 
@router.get("/patient-overview/{patient_id}")
def get_patient_overview(
    patient_id: str,
    provider: dict[str, Any] = Depends(current_provider),
) -> dict[str, Any]:
    """Return the chart overview for one patient (Quick Patient Lookup)."""
    return service.get_patient_overview(provider["id"], patient_id)


@router.get("/visit-overview/{appointment_id}")
def get_visit_overview(
    appointment_id: str,
    provider: dict[str, Any] = Depends(current_provider),
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, Any]:
    
    """Return the full pre-visit summary for one appointment."""
    ctx = SkillContext(
        patient_id=provider["id"],
        user_id=user["id"],
        conversation_id=None,
    )
    reply = _visit_overview_skill.run(ctx, op="detail", appointment_id=appointment_id)
    payload = reply.payload or {}
    visit = payload.get("visit")
    if visit is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=reply.summary,
        )
    return visit