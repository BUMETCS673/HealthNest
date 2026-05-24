"""Lab-result parsers: HL7v2 / JSON / XML → normalized ParsedLabResult."""

from __future__ import annotations

from .base import (
    PARSER_VERSION,
    ParsedEntry,
    ParsedLabResult,
    ParserError,
)
from . import hl7_parser, json_parser, xml_parser


_REGISTRY = {
    "hl7v2": hl7_parser.parse,
    "json": json_parser.parse,
    "xml": xml_parser.parse,
}

_UTF8_BOM = b"\xef\xbb\xbf"
_LEADING_WHITESPACE = b" \t\r\n"


def parse(source_format: str, content: bytes) -> ParsedLabResult:
    if source_format not in _REGISTRY:
        raise ParserError(f"unsupported source_format: {source_format}")
    return _REGISTRY[source_format](content)


def sniff(content: bytes) -> str | None:
    if not content:
        return None
    head = content[:64].lstrip(_LEADING_WHITESPACE)
    if head.startswith(_UTF8_BOM):
        head = head[len(_UTF8_BOM):].lstrip(_LEADING_WHITESPACE)
    if not head:
        return None
    if head.startswith(b"MSH|"):
        return "hl7v2"
    first = head[:1]
    if first in (b"{", b"["):
        return "json"
    if first == b"<":
        return "xml"
    return None


__all__ = [
    "PARSER_VERSION",
    "ParsedEntry",
    "ParsedLabResult",
    "ParserError",
    "parse",
    "sniff",
]
