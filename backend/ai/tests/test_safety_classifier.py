"""
AI-USAGE SUMMARY
Tools: Claude (Opus 4.8)
Overall AI Contribution: ~80%
AI-Assisted Areas: Drafted the pytest cases for the LLM adjudication tier and its integration
into ai.guard.screen via monkeypatched verdicts.
Human Contributions: Pinned the fail-safe contract — the tier no-ops when disabled or unkeyed,
never raises on a bad response, only an ACTIVE non-none verdict promotes a MEDIUM hit to a fired
crisis, and a 'none' verdict lets an ambiguous message through instead of over-firing.
"""

from __future__ import annotations

import json

import pytest

from ai import guard, safety_classifier
from ai.safety import RiskCategory


class _FakeMessage:
    def __init__(self, content):
        self.content = content


class _FakeChoice:
    def __init__(self, content):
        self.message = _FakeMessage(content)


class _FakeCompletion:
    def __init__(self, content):
        self.choices = [_FakeChoice(content)]


class _FakeClient:
    def __init__(self, content):
        payload = content

        class _Completions:
            def create(self, **kwargs):
                return _FakeCompletion(payload)

        class _Chat:
            completions = _Completions()

        self.chat = _Chat()


@pytest.fixture
def enable_llm(monkeypatch):
    monkeypatch.setenv("PULSE_SAFETY_LLM", "true")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")


class TestAdjudicate:
    def test_disabled_returns_none(self, monkeypatch):
        monkeypatch.setenv("PULSE_SAFETY_LLM", "false")
        assert safety_classifier.adjudicate("anything") is None

    def test_parses_active_medical_verdict(self, monkeypatch, enable_llm):
        body = json.dumps(
            {"category": "medical_emergency", "active": True, "confidence": 0.9}
        )
        monkeypatch.setattr(
            safety_classifier, "get_openai", lambda: _FakeClient(body)
        )
        v = safety_classifier.adjudicate("something ambiguous")
        assert v is not None
        assert v.category is RiskCategory.MEDICAL_EMERGENCY
        assert v.active is True

    def test_bad_json_fails_safe_to_none(self, monkeypatch, enable_llm):
        monkeypatch.setattr(
            safety_classifier, "get_openai", lambda: _FakeClient("not json")
        )
        assert safety_classifier.adjudicate("x") is None

    def test_unknown_category_coerced_to_none(self, monkeypatch, enable_llm):
        body = json.dumps({"category": "weird", "active": True, "confidence": 1})
        monkeypatch.setattr(
            safety_classifier, "get_openai", lambda: _FakeClient(body)
        )
        v = safety_classifier.adjudicate("x")
        assert v.category is RiskCategory.NONE


class TestScreenWithLLM:
    def test_medium_promoted_to_fire_when_llm_confirms(self, monkeypatch):
        from ai.safety_classifier import Verdict

        monkeypatch.setattr(
            guard.safety_classifier,
            "adjudicate",
            lambda text: Verdict(RiskCategory.MEDICAL_EMERGENCY, True, 0.95),
        )
        r = guard.screen("chest pain")  # MEDIUM at tier 1
        assert r.triggered is True
        assert r.category is RiskCategory.MEDICAL_EMERGENCY
        assert r.tier == "llm"
        assert "911" in r.canned_reply

    def test_medium_suppressed_when_llm_says_none(self, monkeypatch):
        from ai.safety_classifier import Verdict

        monkeypatch.setattr(
            guard.safety_classifier,
            "adjudicate",
            lambda text: Verdict(RiskCategory.NONE, False, 0.1),
        )
        r = guard.screen("chest pain")
        assert r.triggered is False

    def test_high_confidence_not_downgraded_by_llm(self, monkeypatch):
        from ai.safety_classifier import Verdict

        # Even if the LLM would say none, a HIGH rule hit must still fire.
        called = {"n": 0}

        def _adj(text):
            called["n"] += 1
            return Verdict(RiskCategory.NONE, False, 0.0)

        monkeypatch.setattr(guard.safety_classifier, "adjudicate", _adj)
        r = guard.screen("I can't breathe")
        assert r.triggered is True
        assert called["n"] == 0  # LLM never consulted for HIGH
