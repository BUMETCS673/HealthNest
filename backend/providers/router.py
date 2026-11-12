# AI-USAGE SUMMARY 
# Tools: Claude Code
# Overall AI Contribution: ~80% 
# AI-Assisted Areas: Setting up the router and a get providers endpoint.
# Human Contributions: Business logic and validation.
# Notes: I verified that the router was configured correctly. I may modify it in future iterations and add more functionality, 
# I just used AI to help me quickly set up our prototype application. 


from typing import Any
from datetime import datetime, timezone
 
from fastapi import APIRouter, Depends, HTTPException, status
 
from auth.deps import current_provider, current_user, current_patient_id
from auth.client import get_supabase_admin
from .schemas import ProviderOut, CareTeamProvider
from . import service
from ai.skills.visit_overview_skill import VisitOverviewSkill
from ai.skills.base import SkillContext
 
router = APIRouter(prefix="/providers", tags=["providers"])
 
_visit_overview_skill = VisitOverviewSkill()
 
 
@router.get("/", response_model=list[ProviderOut])
def list_providers():
    """Return all providers."""
    return service.get_providers()


@router.get("/care-team", response_model=list[CareTeamProvider])
def list_care_team(patient_id: str = Depends(current_patient_id)):
    """Return the authenticated patient's active care-team providers."""
    return service.get_care_team(patient_id)
 
 
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


@router.get("/unsigned-encounters")
def list_unsigned_encounters(
    provider: dict[str, Any] = Depends(current_provider),
) -> list[dict[str, Any]]:
    """Return encounters that are still pending provider signature."""
    admin = get_supabase_admin()

    resp = (
        admin.table("encounters")
        .select(
            "id, encounter_date, encounter_type, summary, patient_id, provider_id, signed_at"
        )
        .eq("provider_id", provider["id"])
        .is_("signed_at", "null")
        .order("encounter_date", desc=True)
        .execute()
    )

    rows = resp.data or []

    patient_ids = list(
        {row.get("patient_id") for row in rows if row.get("patient_id")}
    )

    patient_map = {}
    if patient_ids:
        patient_resp = (
            admin.table("patients")
            .select("id, first_name, last_name")
            .in_("id", patient_ids)
            .execute()
        )

        for patient in patient_resp.data or []:
            full_name = " ".join(
                [
                    patient.get("first_name") or "",
                    patient.get("last_name") or "",
                ]
            ).strip()

            patient_map[patient["id"]] = full_name or "Unknown Patient"

    return [
        {
            "id": row.get("id"),
            "name": patient_map.get(row.get("patient_id"), "Unknown Patient"),
            "detail": (
                f"{row.get('encounter_type') or 'Encounter'} · "
                f"{row.get('encounter_date') or 'No date'}"
            ),
            "summary": row.get("summary") or "",
            "urgent": False,
        }
        for row in rows
    ]


@router.patch("/unsigned-encounters/{encounter_id}/sign")
def sign_unsigned_encounter(
    encounter_id: str,
    provider: dict[str, Any] = Depends(current_provider),
) -> dict[str, Any]:
    """Mark one encounter as signed by the authenticated provider."""
    admin = get_supabase_admin()

    existing = (
        admin.table("encounters")
        .select("id, provider_id, signed_at")
        .eq("id", encounter_id)
        .limit(1)
        .execute()
    )

    rows = existing.data or []

    if not rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Encounter not found.",
        )

    encounter = rows[0]

    if encounter.get("provider_id") != provider["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only sign your own encounters.",
        )

    signed_time = datetime.now(timezone.utc).isoformat()

    update_resp = (
        admin.table("encounters")
        .update({"signed_at": signed_time})
        .eq("id", encounter_id)
        .execute()
    )

    return {
        "id": encounter_id,
        "signed": True,
        "signedAt": signed_time,
        "data": update_resp.data,
    }

@router.post("/encounter-notes")
def create_encounter_note(
    payload: dict[str, Any],
    provider: dict[str, Any] = Depends(current_provider),
) -> dict[str, Any]:
    """Create a provider encounter note as a draft or signed note."""
    admin = get_supabase_admin()

    patient_id = payload.get("patientId")
    encounter_type = payload.get("encounterType") or "Visit Note"
    summary = payload.get("summary") or ""
    signed = bool(payload.get("signed"))

    if not patient_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="patientId is required.",
        )

    if not summary.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="summary is required.",
        )

    signed_time = datetime.now(timezone.utc).isoformat() if signed else None

    insert_resp = (
        admin.table("encounters")
        .insert(
            {
                "patient_id": patient_id,
                "provider_id": provider["id"],
                "encounter_date": datetime.now(timezone.utc).date().isoformat(),
                "encounter_type": encounter_type,
                "summary": summary.strip(),
                "signed_at": signed_time,
            }
        )
        .execute()
    )

    rows = insert_resp.data or []

    if not rows:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to create encounter note.",
        )

    return {
        "id": rows[0].get("id"),
        "signed": signed,
        "signedAt": signed_time,
        "encounter": rows[0],
    }