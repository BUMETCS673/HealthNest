"""
AI-USAGE SUMMARY 
Tools: Opus 4.7 
Overall AI Contribution: ~70% 
AI-Assisted Areas: Used AI to implement the standardized parsing logic and data structures for lab results.
Human Contributions: Business logic, validation, error handling, security checks 
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from defusedxml import ElementTree as ET

from .base import (
    PARSER_VERSION,
    ParsedEntry,
    ParsedLabResult,
    ParserError,
    normalize_abnormal_flag,
)


FHIR_NS = "https://hl7.org/fhir"
LOINC_SYSTEM = "https://loinc.org"
_NS = f"{{{FHIR_NS}}}"


def parse(content: bytes) -> ParsedLabResult:
    try:
        root = ET.fromstring(content)
    except ET.ParseError as exc:
        raise ParserError(f"invalid XML: {exc}") from exc

    if _local(root.tag) != "DiagnosticReport":
        raise ParserError(
            f"expected FHIR R4 DiagnosticReport root, got <{_local(root.tag)}>"
        )

    performer = _val(root.find(f"{_NS}performer/{_NS}display"))
    issuer = _val(root.find(f"{_NS}issuer/{_NS}display"))
    requester = _val(root.find(f"{_NS}requester/{_NS}display"))

    collected_at = _parse_dt(_val(root.find(f"{_NS}effectiveDateTime"))) or _parse_dt(
        _val(root.find(f"{_NS}effectivePeriod/{_NS}start"))
    )
    resulted_at = _parse_dt(_val(root.find(f"{_NS}issued")))

    entries: list[ParsedEntry] = []
    for i, obs in enumerate(root.findall(f"{_NS}contained/{_NS}Observation")):
        entries.append(_observation_to_entry(obs, i))

    return ParsedLabResult(
        lab_name=performer or issuer or "Unknown",
        ordering_provider_name=requester,
        collected_at=collected_at,
        resulted_at=resulted_at,
        notes=None,
        parser_version=PARSER_VERSION,
        entries=entries,
    )


def _observation_to_entry(obs, display_order: int) -> ParsedEntry:
    loinc_code, display = _extract_loinc(obs.find(f"{_NS}code"))

    vq = obs.find(f"{_NS}valueQuantity")
    value_text = _val(vq.find(f"{_NS}value")) if vq is not None else None
    unit = _val(vq.find(f"{_NS}unit")) if vq is not None else None

    rr = obs.find(f"{_NS}referenceRange")
    reference_range = None
    if rr is not None:
        low = _val(rr.find(f"{_NS}low/{_NS}value"))
        high = _val(rr.find(f"{_NS}high/{_NS}value"))
        if low is not None and high is not None:
            reference_range = f"{low}-{high}"

    interp_el = obs.find(f"{_NS}interpretation/{_NS}coding/{_NS}code")
    interp_code = _val(interp_el) if interp_el is not None else None

    return ParsedEntry(
        component_name=display or loinc_code or "Unknown",
        loinc_code=loinc_code,
        value_text=value_text,
        value_numeric=_safe_float(value_text),
        unit=unit,
        reference_range=reference_range,
        abnormal_flag=normalize_abnormal_flag(interp_code),
        display_order=display_order,
    )


def _extract_loinc(code_el) -> tuple[str | None, str | None]:
    if code_el is None:
        return None, None
    codings = code_el.findall(f"{_NS}coding")
    for c in codings:
        if _val(c.find(f"{_NS}system")) == LOINC_SYSTEM:
            return _val(c.find(f"{_NS}code")), _val(c.find(f"{_NS}display"))
    if codings:
        first = codings[0]
        return _val(first.find(f"{_NS}code")), _val(first.find(f"{_NS}display"))
    text_el = code_el.find(f"{_NS}text")
    return None, (_val(text_el) if text_el is not None else None)


def _val(el) -> str | None:
    """FHIR elements use `value="..."` attributes; fall back to text content."""
    if el is None:
        return None
    v = el.get("value")
    if v is None and el.text:
        v = el.text.strip()
    return v if v else None


def _local(tag: str) -> str:
    return tag.split("}", 1)[1] if "}" in tag else tag


def _safe_float(v: Any) -> float | None:
    if v is None or v == "":
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _parse_dt(v: Any) -> datetime | None:
    if not v:
        return None
    try:
        s = str(v).replace("Z", "+00:00")
        dt = datetime.fromisoformat(s)
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except ValueError:
        return None
