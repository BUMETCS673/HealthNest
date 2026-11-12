"""
AI-USAGE SUMMARY
Tools: Opus 4.7
Overall AI Contribution: ~65%
AI-Assisted Areas: Drafted the FastAPI route handlers, Depends injection, and the JSON response wrappers for the upload/patch/release/archive/list/get/file endpoints.
Human Contributions: Designed the endpoint surface, picked the role-autodetect routing (provider-first then patient), defined the 400/403/422 error semantics, and wired the auto-detect sniff path with the format whitelist fallback.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from auth.deps import current_patient, current_provider, current_user

from . import parsers, service
from .schemas import (
    LabResultOut,
    LabResultPatch,
    LabResultSummary,
    SignedFileUrl,
)


_ALLOWED_FORMATS = {"hl7v2", "json", "xml"}


router = APIRouter(prefix="/lab-results", tags=["lab-results"])



@router.post("", response_model=LabResultOut, status_code=status.HTTP_201_CREATED)
async def upload_lab_result(
    file: UploadFile = File(...),
    patient_id: str = Form(...),
    source_format: str | None = Form(default=None),
    diagnostic_order_id: str | None = Form(default=None),
    provider: dict[str, Any] = Depends(current_provider),
    user: dict[str, Any] = Depends(current_user),
) -> LabResultOut:
    content = await file.read()

    resolved_format = source_format or parsers.sniff(content)
    if not resolved_format:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Unable to detect file format. "
                "Expected HL7 v2 (starts with MSH|), FHIR JSON, or FHIR XML."
            ),
        )
    if resolved_format not in _ALLOWED_FORMATS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="source_format must be one of: hl7v2, json, xml",
        )

    detail = service.upload(
        actor_user_id=user["id"],
        provider_id=provider["id"],
        patient_id=patient_id,
        source_format=resolved_format,
        filename=file.filename or "upload",
        content=content,
        diagnostic_order_id=diagnostic_order_id,
    )
    return LabResultOut(**detail)



@router.patch("/{lab_result_id}", response_model=LabResultOut)
def patch_lab_result(
    lab_result_id: str,
    payload: LabResultPatch,
    provider: dict[str, Any] = Depends(current_provider),
    user: dict[str, Any] = Depends(current_user),
) -> LabResultOut:
    return LabResultOut(
        **service.patch(
            actor_user_id=user["id"],
            provider_id=provider["id"],
            lab_result_id=lab_result_id,
            payload=payload,
        )
    )


@router.post("/{lab_result_id}/release", response_model=LabResultOut)
def release_lab_result(
    lab_result_id: str,
    provider: dict[str, Any] = Depends(current_provider),
    user: dict[str, Any] = Depends(current_user),
) -> LabResultOut:
    return LabResultOut(
        **service.release(
            actor_user_id=user["id"],
            provider_id=provider["id"],
            lab_result_id=lab_result_id,
        )
    )


@router.post("/{lab_result_id}/archive", response_model=LabResultOut)
def archive_lab_result(
    lab_result_id: str,
    provider: dict[str, Any] = Depends(current_provider),
    user: dict[str, Any] = Depends(current_user),
) -> LabResultOut:
    return LabResultOut(
        **service.archive(
            actor_user_id=user["id"],
            provider_id=provider["id"],
            lab_result_id=lab_result_id,
        )
    )



@router.get("", response_model=list[LabResultSummary])
def list_lab_results(
    patient_id: str | None = None,
    status_filter: str | None = None,
    limit: int = 50,
    offset: int = 0,
    user: dict[str, Any] = Depends(current_user),
) -> list[LabResultSummary]:
    limit = max(1, min(limit, 100))
    offset = max(0, offset)

    provider = _maybe_provider(user)
    if provider is not None:
        rows = service.list_for_provider(
            provider_id=provider["id"],
            patient_id=patient_id,
            status_filter=status_filter,
            limit=limit,
            offset=offset,
        )
        return [LabResultSummary(**r) for r in rows]

    patient = _maybe_patient(user)
    if patient is not None:
        if patient_id and patient_id != patient["id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="patients can only view their own lab results",
            )
        rows = service.list_for_patient(
            patient_id=patient["id"], limit=limit, offset=offset
        )
        return [LabResultSummary(**r) for r in rows]

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="caller is neither a patient nor a provider",
    )


@router.get("/{lab_result_id}", response_model=LabResultOut)
def get_lab_result(
    lab_result_id: str,
    user: dict[str, Any] = Depends(current_user),
) -> LabResultOut:
    provider = _maybe_provider(user)
    if provider is not None:
        return LabResultOut(
            **service.get_for_provider(
                provider_id=provider["id"], lab_result_id=lab_result_id
            )
        )
    patient = _maybe_patient(user)
    if patient is not None:
        return LabResultOut(
            **service.get_for_patient(
                patient_id=patient["id"], lab_result_id=lab_result_id
            )
        )
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="forbidden")


@router.get("/{lab_result_id}/file", response_model=SignedFileUrl)
def get_lab_result_file_url(
    lab_result_id: str,
    user: dict[str, Any] = Depends(current_user),
) -> SignedFileUrl:
    expires = 60
    provider = _maybe_provider(user)
    if provider is not None:
        url = service.signed_file_url_for_provider(
            provider_id=provider["id"],
            lab_result_id=lab_result_id,
            expires_in_seconds=expires,
        )
        return SignedFileUrl(url=url, expires_in_seconds=expires)
    patient = _maybe_patient(user)
    if patient is not None:
        url = service.signed_file_url_for_patient(
            patient_id=patient["id"],
            lab_result_id=lab_result_id,
            expires_in_seconds=expires,
        )
        return SignedFileUrl(url=url, expires_in_seconds=expires)
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="forbidden")


def _maybe_provider(user: dict[str, Any]) -> dict[str, Any] | None:
    try:
        return current_provider(user=user)
    except HTTPException:
        return None


def _maybe_patient(user: dict[str, Any]) -> dict[str, Any] | None:
    try:
        return current_patient(user=user)
    except HTTPException:
        return None
