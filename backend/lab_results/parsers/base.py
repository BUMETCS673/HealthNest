"""
AI-USAGE SUMMARY 
Tools: Opus 4.7 
Overall AI Contribution: ~70% 
AI-Assisted Areas: Used AI to implement the standardized parsing logic and data structures for lab results.
Human Contributions: Business logic, validation, error handling, security checks 
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Literal


PARSER_VERSION = "1.0.0"

AbnormalFlag = Literal[
    "normal", "low", "high", "critical_low", "critical_high", "abnormal"
]


class ParserError(Exception):
    """Raised when a file cannot be parsed at all (vs. partial parse)."""


@dataclass
class ParsedEntry:
    component_name: str
    loinc_code: str | None = None
    value_text: str | None = None
    value_numeric: float | None = None
    unit: str | None = None
    reference_range: str | None = None
    abnormal_flag: AbnormalFlag = "normal"
    needs_manual_entry: bool = False
    display_order: int = 0


@dataclass
class ParsedLabResult:
    lab_name: str
    ordering_provider_name: str | None = None
    collected_at: datetime | None = None
    resulted_at: datetime | None = None
    notes: str | None = None
    parser_version: str = PARSER_VERSION
    parse_error: str | None = None
    entries: list[ParsedEntry] = field(default_factory=list)


_HL7_ABNORMAL_MAP = {
    "N": "normal",
    "L": "low",
    "H": "high",
    "LL": "critical_low",
    "HH": "critical_high",
    "A": "abnormal",
    "AA": "abnormal",
}


def normalize_abnormal_flag(raw: str | None) -> AbnormalFlag:
    if not raw:
        return "normal"
    key = raw.strip().upper()
    return _HL7_ABNORMAL_MAP.get(key, "normal")  # type: ignore[return-value]
