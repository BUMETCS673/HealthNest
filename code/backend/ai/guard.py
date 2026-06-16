"""
AI-USAGE SUMMARY
Tools: Claude (Opus 4.8)
Overall AI Contribution: ~60%
AI-Assisted Areas: Drafted the two-tier orchestration that combines the deterministic
detector with the optional LLM adjudicator.
Human Contributions: Owned the escalation policy. HIGH-confidence rule hits fire immediately
(never weakened by the LLM). MEDIUM hits are adjudicated; when the LLM tier is unavailable the
fallback is category-specific — a possible self-harm crisis still surfaces resources (a miss is
high-harm, showing 988 is low-harm), while an ambiguous medical mention does NOT auto-route to
911 (false "call 911" is the overprotective failure we were told to avoid). Kept `screen` /
`GuardResult` exactly as the assistant pipeline already consumes them so this drops in cleanly.

Public entry point for Pulse safety screening. Tier 1 = ai.safety.detect (rules),
Tier 2 = ai.safety_classifier.adjudicate (LLM, only for MEDIUM cases).
"""

from __future__ import annotations

from . import safety_classifier
from .safety import (
    HIGH,
    MEDIUM,
    REPLY_FOR,
    GuardResult,
    RiskCategory,
    detect,
)

__all__ = ["GuardResult", "RiskCategory", "screen", "detect"]


def screen(text: str) -> GuardResult:
    """Screen a user message and decide whether to route it to emergency/crisis help.

    Always returns a GuardResult; never raises. `is_emergency` / `canned_reply` remain
    available as backward-compatible aliases on the result.
    """
    result = detect(text)

    if result.confidence == HIGH:
        return result

    if result.confidence == MEDIUM:
        verdict = safety_classifier.adjudicate(text)

        if verdict is None:
            # LLM tier unavailable — fall back by category.
            if result.category == RiskCategory.SELF_HARM_CRISIS:
                return GuardResult(
                    triggered=True,
                    category=result.category,
                    confidence=MEDIUM,
                    reply=REPLY_FOR[result.category],
                    tier="rules-fallback",
                    signals=result.signals,
                )
            return GuardResult(triggered=False)

        if verdict.active and verdict.category != RiskCategory.NONE:
            return GuardResult(
                triggered=True,
                category=verdict.category,
                confidence=HIGH,
                reply=REPLY_FOR[verdict.category],
                tier="llm",
                signals=result.signals,
            )
        return GuardResult(triggered=False)

    return GuardResult(triggered=False)
