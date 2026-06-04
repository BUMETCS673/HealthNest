"""
AI-USAGE SUMMARY
Tools: Claude (Opus 4.8)
Overall AI Contribution: ~85%
AI-Assisted Areas: Drafted the pytest cases for ai.guard — the emergency-keyword scanner and the GuardResult shape.
Human Contributions: Chose which keywords to lock down (the conservative set that must route to the canned 911 reply), verified the matching is case-insensitive and substring-based, and confirmed every expected value against the actual guard implementation.
"""

from __future__ import annotations

from ai.guard import GuardResult, screen
from ai.prompts import EMERGENCY_REPLY


class TestScreen:
    def test_empty_text_is_not_an_emergency(self):
        result = screen("")
        assert isinstance(result, GuardResult)
        assert result.is_emergency is False
        assert result.canned_reply is None

    def test_none_text_is_not_an_emergency(self):
        result = screen(None)  # type: ignore[arg-type]
        assert result.is_emergency is False

    def test_benign_message_is_not_an_emergency(self):
        result = screen("When is my next appointment?")
        assert result.is_emergency is False
        assert result.canned_reply is None

    def test_chest_pain_triggers_emergency(self):
        result = screen("I've had chest pain since this morning")
        assert result.is_emergency is True
        assert result.canned_reply == EMERGENCY_REPLY

    def test_matching_is_case_insensitive(self):
        result = screen("I think I'm having a HEART ATTACK")
        assert result.is_emergency is True

    def test_matches_keyword_as_substring(self):
        # "suicid" is the stored stem so "suicidal" must still match.
        result = screen("I have been feeling suicidal")
        assert result.is_emergency is True

    def test_canned_reply_points_to_emergency_services(self):
        result = screen("severe bleeding that won't stop")
        assert "911" in result.canned_reply
        assert "988" in result.canned_reply
