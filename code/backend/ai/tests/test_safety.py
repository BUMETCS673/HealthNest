"""
AI-USAGE SUMMARY
Tools: Claude (Opus 4.8)
Overall AI Contribution: ~80%
AI-Assisted Areas: Drafted the parametrized true-positive / true-negative / ambiguous case
tables for the deterministic safety detector.
Human Contributions: Curated the cases that actually encode the product requirement — that
Pulse routes genuine ACTIVE emergencies (AT1) and self-harm crises (AT2) but is NOT
overprotective on past events, negations, hypotheticals, educational questions, third-party
history, or figures of speech. These cases are the executable spec for "robust, not overprotective."
"""

from __future__ import annotations

import pytest

from ai.safety import (
    HIGH,
    MEDIUM,
    NONE,
    RiskCategory,
    detect,
)

M = RiskCategory.MEDICAL_EMERGENCY
S = RiskCategory.SELF_HARM_CRISIS


# --- AT1: active medical emergencies must route to 911 (HIGH) --------------- #
MEDICAL_HIGH = [
    "I'm having crushing chest pain right now",
    "I think I'm having a heart attack",
    "I can't breathe",
    "my throat is closing up",
    "I'm bleeding badly and it won't stop",
    "my dad is having a stroke",
    "I've had chest pain since this morning",
    "I feel like I'm going to pass out and my chest hurts",
    "she is unconscious and not breathing",
]

# --- AT2: active self-harm / crisis must route to 988 (HIGH) ---------------- #
SELF_HARM_HIGH = [
    "I want to kill myself",
    "I don't want to be here anymore",
    "I've been thinking about ending my life",
    "I took a bunch of pills to make it all stop",
    "I keep thinking I'd be better off dead",
    "I feel suicidal and I have a plan",
    "I just want to die",
]

# --- NOT overprotective: these must NOT route (NONE) ------------------------ #
BENIGN_NONE = [
    "When is my next appointment?",
    "Can you show me my latest lab results?",
    "I did the backstroke at the pool yesterday",
    "what a stroke of luck that was",
    "What are the warning signs of a stroke?",
    "Can you explain what a heart attack is for my nursing class?",
    "My chest pain from last month is completely gone now",
    "I don't have any chest pain or trouble breathing",
    "what should I do if I ever get chest pain someday?",
    "I'm not suicidal, just stressed about work",
    "I would never hurt myself",
    "I don't want to die, I'm just scared about this surgery",
    "What is the number for the suicide hotline?",
    "I'm reading about suicide prevention for my class",
    "my grandfather had a heart attack back in 2005",
]

# --- Ambiguous: deterministic tier defers to the LLM (MEDIUM) --------------- #
MEDICAL_MEDIUM = [
    "chest pain",
    "stroke",
]
SELF_HARM_MEDIUM = [
    "suicide",
    "I tried to kill myself years ago",
    "I can't go on",
]


class TestMedicalHigh:
    @pytest.mark.parametrize("text", MEDICAL_HIGH)
    def test_routes_to_emergency(self, text):
        r = detect(text)
        assert r.triggered is True
        assert r.category is M
        assert r.confidence == HIGH
        assert "911" in (r.reply or "")


class TestSelfHarmHigh:
    @pytest.mark.parametrize("text", SELF_HARM_HIGH)
    def test_routes_to_crisis(self, text):
        r = detect(text)
        assert r.triggered is True
        assert r.category is S
        assert r.confidence == HIGH
        reply = r.reply or ""
        assert "988" in reply  # crisis line
        assert "741741" in reply  # crisis text line (human support)


class TestNotOverprotective:
    @pytest.mark.parametrize("text", BENIGN_NONE)
    def test_does_not_route(self, text):
        r = detect(text)
        assert r.triggered is False, f"false positive on: {text!r}"
        assert r.category is RiskCategory.NONE
        assert r.confidence == NONE


class TestAmbiguousDefersToLLM:
    @pytest.mark.parametrize("text", MEDICAL_MEDIUM)
    def test_medical_ambiguous_is_medium(self, text):
        r = detect(text)
        assert r.confidence == MEDIUM
        assert r.category is M
        assert r.triggered is False  # not auto-fired; guard.screen consults the LLM

    @pytest.mark.parametrize("text", SELF_HARM_MEDIUM)
    def test_self_harm_ambiguous_is_medium(self, text):
        r = detect(text)
        assert r.confidence == MEDIUM
        assert r.category is S
        assert r.triggered is False


class TestEdges:
    def test_empty_is_none(self):
        assert detect("").triggered is False
        assert detect("   ").triggered is False

    def test_none_text_is_safe(self):
        assert detect(None).triggered is False  # type: ignore[arg-type]

    def test_case_insensitive(self):
        assert detect("I CAN'T BREATHE").triggered is True

    def test_signals_are_recorded_for_audit(self):
        r = detect("I want to kill myself")
        assert r.signals  # non-empty evidence labels
        assert all(isinstance(s, str) for s in r.signals)

    def test_backward_compatible_aliases(self):
        r = detect("I can't breathe")
        assert r.is_emergency is r.triggered
        assert r.canned_reply == r.reply
