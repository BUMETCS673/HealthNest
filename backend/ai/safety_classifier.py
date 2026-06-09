"""
AI-USAGE SUMMARY
Tools: Claude (Opus 4.8)
Overall AI Contribution: ~70%
AI-Assisted Areas: Drafted the strict-JSON classification prompt and the OpenAI call that
adjudicates MEDIUM-confidence safety hits, plus the defensive parsing.
Human Contributions: Made the tier OPT-OUTABLE and FAIL-SAFE — it must never raise into the
request path, must no-op when disabled or unkeyed (so tests and offline runs are hermetic),
and must only ever CONFIRM a real, currently-active risk. The deterministic Tier-1 rules
remain the source of truth for what's even worth asking about; this tier exists purely to
keep Pulse from over-firing on ambiguous phrasing.

This is Tier 2 of the safety layer. It is consulted by `ai.guard.screen` only when Tier-1
(`ai.safety.detect`) returns MEDIUM. Enable/disable with PULSE_SAFETY_LLM (default on).
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass

from .client import chat_model, get_openai
from .safety import RiskCategory

_log = logging.getLogger(__name__)

_SYSTEM_PROMPT = (
    "You are a safety classifier for a patient-facing healthcare assistant. "
    "Decide whether the user's message indicates the person (or someone physically "
    "with them right now) is CURRENTLY experiencing one of:\n"
    "- medical_emergency: an acute, life-threatening medical situation needing 911 / "
    "emergency care right now (e.g. active chest pain, can't breathe, stroke signs, "
    "anaphylaxis, severe bleeding, unconsciousness).\n"
    "- self_harm_crisis: active suicidal ideation, intent or plan to self-harm, or a "
    "self-harm act in progress.\n\n"
    "Classify as 'none' if the message is: a general/educational question, a past or "
    "resolved event, a hypothetical, a third-party history (not happening now), a "
    "figure of speech, or an explicit denial. When in doubt between a live crisis and "
    "a non-crisis mention, prefer the category ONLY if the person seems to be in or "
    "near the situation right now; otherwise choose 'none'.\n\n"
    'Reply with ONLY a JSON object: {"category": "none"|"medical_emergency"|'
    '"self_harm_crisis", "active": true|false, "confidence": 0.0-1.0}. '
    "'active' must be true only if it is happening now or imminently."
)


@dataclass
class Verdict:
    category: RiskCategory
    active: bool
    confidence: float


def _enabled() -> bool:
    return os.environ.get("PULSE_SAFETY_LLM", "true").lower() in {"1", "true", "yes"}


def adjudicate(text: str) -> Verdict | None:
    """Ask the model to confirm/deny an ambiguous safety hit.

    Returns a Verdict, or None if the tier is disabled, unconfigured, or errors —
    in which case the caller falls back to its deterministic decision.
    """
    if not _enabled() or not text or not text.strip():
        return None
    if not os.environ.get("OPENAI_API_KEY"):
        return None
    try:
        resp = get_openai().chat.completions.create(
            model=chat_model(),
            temperature=0,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": text[:2000]},
            ],
        )
        raw = resp.choices[0].message.content or "{}"
        data = json.loads(raw)
    except Exception as exc:  # network, parse, schema — all fail safe
        _log.warning("safety adjudicator unavailable: %s", exc)
        return None

    try:
        category = RiskCategory(str(data.get("category", "none")))
    except ValueError:
        category = RiskCategory.NONE
    active = bool(data.get("active", False))
    try:
        confidence = float(data.get("confidence", 0.0))
    except (TypeError, ValueError):
        confidence = 0.0
    return Verdict(category=category, active=active, confidence=confidence)
