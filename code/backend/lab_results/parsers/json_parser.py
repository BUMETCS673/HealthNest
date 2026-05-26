"""
AI-USAGE SUMMARY 
Tools: Opus 4.7 
Overall AI Contribution: ~70% 
AI-Assisted Areas: Used AI to implement the standardized parsing logic and data structures for lab results.
Human Contributions: Business logic, validation, error handling, security checks 
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from .base import (
    PARSER_VERSION,
    ParsedEntry,
    ParsedLabResult,
    ParserError,
    normalize_abnormal_flag,
)


LOINC_SYSTEM = "http://loinc.org"


def parse(content: bytes) -> ParsedLabResult:
    try:
        doc = json.loads(content.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ParserError(f"invalid JSON: {exc}") from exc

    if not isinstance(doc, dict) or doc.get("resourceType") != "DiagnosticReport":
        raise ParserError(
            "expected FHIR R4 DiagnosticReport (resourceType=DiagnosticReport)"
        )

    contained = doc.get("contained") or []
    if not isinstance(contained, list):
        raise ParserError("`contained` must be a list of Observation resources")

    entries: list[ParsedEntry] = []
    for i, obs in enumerate(contained):
        if not isinstance(obs, dict) or obs.get("resourceType") != "Observation":
            continue
        entries.append(_observation_to_entry(obs, i))

    performer = (doc.get("performer") or [{}])[0]
    issuer = (doc.get("issuer") or {}).get("display")
    requester = (doc.get("requester") or {}).get("display")

    return ParsedLabResult(
        lab_name=str(performer.get("display") or issuer or "Unknown"),
        ordering_provider_name=_opt_str(requester),
        collected_at=_parse_dt(doc.get("effectiveDateTime"))
        or _parse_dt((doc.get("effectivePeriod") or {}).get("start")),
        resulted_at=_parse_dt(doc.get("issued")),
        notes=None,
        parser_version=PARSER_VERSION,
        entries=entries,
    )


def _observation_to_entry(obs: dict[str, Any], display_order: int) -> ParsedEntry:
    loinc_code, display = _extract_loinc(obs.get("code") or {})

    vq = obs.get("valueQuantity") or {}
    value_text = _opt_str(vq.get("value"))
    value_numeric = _opt_float(vq.get("value"))
    unit = _opt_str(vq.get("unit"))

    rr_list = obs.get("referenceRange") or []
    rr = rr_list[0] if rr_list else {}
    low = (rr.get("low") or {}).get("value")
    high = (rr.get("high") or {}).get("value")
    reference_range = f"{low}-{high}" if low is not None and high is not None else None

    interp_list = obs.get("interpretation") or []
    interp = interp_list[0] if interp_list else {}
    interp_code = ((interp.get("coding") or [{}])[0] or {}).get("code")

    return ParsedEntry(
        component_name=display or loinc_code or "Unknown",
        loinc_code=loinc_code,
        value_text=value_text,
        value_numeric=value_numeric,
        unit=unit,
        reference_range=reference_range,
        abnormal_flag=normalize_abnormal_flag(interp_code),
        display_order=display_order,
    )


def _extract_loinc(code: dict[str, Any]) -> tuple[str | None, str | None]:
    """Prefer the LOINC coding; fall back to the first coding if no LOINC entry."""
    codings = code.get("coding") or []
    for c in codings:
        if not isinstance(c, dict):
            continue
        if c.get("system") == LOINC_SYSTEM:
            return _opt_str(c.get("code")), _opt_str(c.get("display"))
    if codings and isinstance(codings[0], dict):
        return _opt_str(codings[0].get("code")), _opt_str(codings[0].get("display"))
    return None, _opt_str(code.get("text"))


def _opt_str(v: Any) -> str | None:
    if v is None or v == "":
        return None
    return str(v)


def _opt_float(v: Any) -> float | None:
    if v is None or v == "":
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _parse_dt(v: Any) -> datetime | None:
    if not v:
        return None
    if isinstance(v, datetime):
        return v if v.tzinfo else v.replace(tzinfo=timezone.utc)
    try:
        s = str(v).replace("Z", "+00:00")
        dt = datetime.fromisoformat(s)
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except ValueError:
        return None
