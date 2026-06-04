"""
AI-USAGE SUMMARY
Tools: Opus 4.7
Overall AI Contribution: ~55%
AI-Assisted Areas: Drafted the GuardResult dataclass + the keyword scanner.
Human Contributions: Picked the conservative keyword list (kept in prompts.EMERGENCY_KEYWORDS so the matching set lives next to the canned reply), and decided that the guard returns a structured result instead of raising — the assistant pipeline composes the canned message into the conversation just like any other reply so the audit trail is uniform.
"""

from __future__ import annotations

from dataclasses import dataclass

from .prompts import EMERGENCY_KEYWORDS, EMERGENCY_REPLY


@dataclass
class GuardResult:
    is_emergency: bool
    canned_reply: str | None = None


def screen(text: str) -> GuardResult:
    if not text:
        return GuardResult(is_emergency=False)
    lower = text.lower()
    for kw in EMERGENCY_KEYWORDS:
        if kw in lower:
            return GuardResult(is_emergency=True, canned_reply=EMERGENCY_REPLY)
    return GuardResult(is_emergency=False)
