"""
AI-USAGE SUMMARY
Tools: Opus 4.7
Overall AI Contribution: ~70%
AI-Assisted Areas: Used AI to implement the standardized parsing logic and data structures for lab results.
Human Contributions: Business logic, validation, error handling, security checks
"""

from __future__ import annotations

import re
from datetime import datetime, timezone

import hl7

from .base import (
    PARSER_VERSION,
    ParsedEntry,
    ParsedLabResult,
    ParserError,
    normalize_abnormal_flag,
)


LOINC_CODING_SYSTEM = "LN"
_LOINC_RE = re.compile(r"^\d{1,5}-\d$")
_NUMERIC_VALUE_TYPES = {"NM", "SN", "NU"}
_TEXT_VALUE_TYPES = {"TX", "ST", "FT", "CE", "CWE"}
_HL7_ESCAPES = (
    ("\\.br\\", "\n"),
    ("\\X000d\\", "\n"),
    ("\\X0d\\", "\n"),
    ("\\X000a\\", "\n"),
    ("\\X0a\\", "\n"),
    ("\\F\\", "|"),
    ("\\S\\", "^"),
    ("\\R\\", "~"),
    ("\\T\\", "&"),
    ("\\E\\", "\\"),
)


def parse(content: bytes) -> ParsedLabResult:
    try:
        text = content.decode("utf-8", errors="replace")
        text = text.replace("\r\n", "\r").replace("\n", "\r").strip()
        msg = hl7.parse(text)
    except Exception as exc:
        raise ParserError(f"invalid HL7 v2 message: {exc}") from exc

    lab_name: str | None = None
    ordering_provider_name: str | None = None
    collected_at: datetime | None = None
    resulted_at: datetime | None = None
    notes_parts: list[str] = []
    entries: list[ParsedEntry] = []
    primary_obr_seen = False
    display_order = 0

    for segment in msg:
        seg_id = str(segment[0])

        if seg_id == "MSH":
            lab_name = _field(segment, 4) or lab_name

        elif seg_id == "OBR":
            if not primary_obr_seen:
                collected_at = _parse_hl7_dt(_field(segment, 7)) or collected_at
                resulted_at = _parse_hl7_dt(_field(segment, 22)) or resulted_at
                ordering_provider_name = (
                    _person_name(_field(segment, 16))
                    or _person_name(_field(segment, 32))
                    or ordering_provider_name
                )
                primary_obr_seen = True

        elif seg_id == "OBX":
            entry = _obx_to_entry(segment, display_order, notes_parts)
            if entry is not None:
                entries.append(entry)
                display_order += 1
            if resulted_at is None:
                resulted_at = _parse_hl7_dt(_field(segment, 14)) or resulted_at

        elif seg_id == "NTE":
            comment = _field(segment, 3)
            if comment:
                notes_parts.append(_decode_escapes(comment))

    notes = "\n".join(p for p in notes_parts if p).strip() or None

    return ParsedLabResult(
        lab_name=lab_name or "Unknown",
        ordering_provider_name=ordering_provider_name,
        collected_at=collected_at,
        resulted_at=resulted_at,
        notes=notes,
        parser_version=PARSER_VERSION,
        entries=entries,
    )


def _obx_to_entry(
    segment, display_order: int, notes_parts: list[str]
) -> ParsedEntry | None:
    value_type = (_field(segment, 2) or "").upper()
    raw_value = _field(segment, 5)
    obs_id = _field(segment, 3) or ""
    loinc_code, name = _extract_loinc(obs_id)

    if value_type == "ED":
        return None

    if value_type in _TEXT_VALUE_TYPES or (
        value_type and value_type not in _NUMERIC_VALUE_TYPES
        and not _looks_numeric(raw_value, value_type)
    ):
        if raw_value:
            text = _decode_escapes(raw_value).replace("~", "\n").strip()
            if text:
                notes_parts.append(text)
        return None

    if not raw_value:
        return None

    return ParsedEntry(
        component_name=name or loinc_code or "Unknown",
        loinc_code=loinc_code,
        value_text=raw_value,
        value_numeric=_coerce_numeric(raw_value, value_type),
        unit=_field(segment, 6) or None,
        reference_range=_field(segment, 7) or None,
        abnormal_flag=normalize_abnormal_flag(_field(segment, 8)),
        display_order=display_order,
    )


def _extract_loinc(raw: str) -> tuple[str | None, str | None]:
    parts = raw.split("^")

    def at(i: int) -> str:
        return parts[i].strip() if i < len(parts) else ""

    primary_code, primary_name, primary_sys = at(0), at(1), at(2)
    alt_code, alt_name, alt_sys = at(3), at(4), at(5)

    if alt_sys == LOINC_CODING_SYSTEM and alt_code:
        return alt_code, (alt_name or primary_name or primary_code or None)
    if primary_sys == LOINC_CODING_SYSTEM and primary_code:
        return primary_code, (primary_name or None)
    if primary_code and _LOINC_RE.match(primary_code):
        return primary_code, (primary_name or None)
    if alt_code and _LOINC_RE.match(alt_code):
        return alt_code, (alt_name or primary_name or None)
    return None, (primary_name or alt_name or primary_code or None)


def _person_name(raw: str | None) -> str | None:
    if not raw:
        return None
    parts = raw.split("^")
    if len(parts) < 2:
        return raw.strip() or None
    family = parts[1].strip() if len(parts) > 1 else ""
    given = parts[2].strip() if len(parts) > 2 else ""
    name = f"{given} {family}".strip()
    return name or raw.strip() or None


def _field(segment, idx: int) -> str | None:
    try:
        v = segment[idx]
    except IndexError:
        return None
    s = str(v).strip()
    return s or None


def _looks_numeric(s: str | None, value_type: str) -> bool:
    if not s:
        return False
    candidate = s
    if value_type == "SN":
        parts = s.split("^")
        candidate = parts[1] if len(parts) > 1 and parts[1] else (parts[0] if parts else "")
    try:
        float(candidate)
        return True
    except (TypeError, ValueError):
        return False


def _coerce_numeric(raw: str | None, value_type: str) -> float | None:
    if not raw:
        return None
    candidate = raw
    if value_type == "SN":
        parts = raw.split("^")
        candidate = parts[1] if len(parts) > 1 and parts[1] else (parts[0] if parts else "")
    try:
        return float(candidate)
    except (TypeError, ValueError):
        return None


def _decode_escapes(s: str) -> str:
    out = s
    for src, dst in _HL7_ESCAPES:
        out = out.replace(src, dst)
    return out


def _parse_hl7_dt(s: str | None) -> datetime | None:
    if not s:
        return None
    digits = "".join(ch for ch in s if ch.isdigit())
    if len(digits) < 8:
        return None
    for length, fmt in (
        (14, "%Y%m%d%H%M%S"),
        (12, "%Y%m%d%H%M"),
        (10, "%Y%m%d%H"),
        (8, "%Y%m%d"),
    ):
        if len(digits) >= length:
            try:
                return datetime.strptime(digits[:length], fmt).replace(tzinfo=timezone.utc)
            except ValueError:
                continue
    return None
