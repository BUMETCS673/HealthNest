"""
AI-USAGE SUMMARY
Tools: Claude (Opus 4.8)
Overall AI Contribution: ~80%
AI-Assisted Areas: Drafted the pytest cases for ai.guard.screen — the two-tier orchestration
and the backward-compatible GuardResult surface.
Human Contributions: Pinned the escalation contract the assistant pipeline relies on: HIGH
rule hits fire as-is; with the LLM tier off (the hermetic test default) a possible self-harm
crisis still surfaces resources while an ambiguous medical mention does not auto-route to 911;
and `is_emergency` / `canned_reply` stay valid so the SSE pipeline is untouched.
"""

from __future__ import annotations

from ai.guard import GuardResult, screen
from ai.safety import HIGH, MEDIUM, RiskCategory


class TestScreenBackwardCompat:
    def test_empty_text_is_not_an_emergency(self):
        r = screen("")
        assert isinstance(r, GuardResult)
        assert r.is_emergency is False
        assert r.canned_reply is None

    def test_none_text_is_not_an_emergency(self):
        assert screen(None).is_emergency is False  # type: ignore[arg-type]

    def test_benign_message_is_not_an_emergency(self):
        r = screen("When is my next appointment?")
        assert r.is_emergency is False
        assert r.canned_reply is None


class TestMedicalRouting:
    def test_active_chest_pain_routes_to_911(self):
        r = screen("I've had chest pain since this morning")
        assert r.triggered is True
        assert r.category is RiskCategory.MEDICAL_EMERGENCY
        assert "911" in r.canned_reply

    def test_heart_attack_active(self):
        r = screen("I think I'm having a HEART ATTACK")
        assert r.triggered is True
        assert r.category is RiskCategory.MEDICAL_EMERGENCY

    def test_ambiguous_medical_does_not_autofire_without_llm(self):
        # LLM tier disabled in tests -> ambiguous medical must NOT route to 911.
        r = screen("chest pain")
        assert r.triggered is False


class TestSelfHarmRouting:
    def test_self_harm_routes_to_crisis_resources(self):
        r = screen("I have been feeling suicidal and I want to die")
        assert r.triggered is True
        assert r.category is RiskCategory.SELF_HARM_CRISIS
        assert "988" in r.canned_reply
        assert "741741" in r.canned_reply

    def test_ambiguous_self_harm_falls_back_to_resources_without_llm(self):
        # A bare, ambiguous mention -> MEDIUM. With the LLM off, the safe fallback
        # for a possible crisis is to surface resources (a miss is high-harm).
        r = screen("suicide")
        assert r.triggered is True
        assert r.category is RiskCategory.SELF_HARM_CRISIS
        assert r.tier == "rules-fallback"
        assert r.confidence == MEDIUM


class TestNotOverprotective:
    def test_reassurance_does_not_route(self):
        assert screen("I'm not suicidal, just stressed").triggered is False

    def test_educational_question_does_not_route(self):
        assert screen("What are the warning signs of a stroke?").triggered is False

    def test_resolved_history_does_not_route(self):
        assert screen("My chest pain from last month is gone").triggered is False

    def test_high_confidence_hit_keeps_rules_tier(self):
        r = screen("I can't breathe")
        assert r.triggered is True
        assert r.tier == "rules"
        assert r.confidence == HIGH
