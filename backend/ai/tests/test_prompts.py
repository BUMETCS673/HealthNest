"""
AI-USAGE SUMMARY
Tools: Claude (Opus 4.8)
Overall AI Contribution: ~85%
AI-Assisted Areas: Drafted the pytest cases for ai.prompts.patient_identity_message and sanity checks on the static system prompt / emergency constants.
Human Contributions: Chose the profile permutations that matter (missing profile, name-only, preferred-name dedupe against first name, DOB/MRN inclusion) and verified the rendered lines against the actual prompt builder.
"""

from __future__ import annotations

from ai.prompts import (
    EMERGENCY_KEYWORDS,
    EMERGENCY_REPLY,
    PFA_SYSTEM_PROMPT,
    patient_identity_message,
)


class TestPatientIdentityMessage:
    def test_returns_none_for_missing_profile(self):
        assert patient_identity_message(None) is None

    def test_returns_none_for_empty_profile(self):
        assert patient_identity_message({}) is None

    def test_includes_full_name(self):
        msg = patient_identity_message({"first_name": "Ada", "last_name": "Lovelace"})
        assert msg is not None
        assert "Patient name: Ada Lovelace." in msg

    def test_includes_preferred_name_when_different(self):
        msg = patient_identity_message(
            {"first_name": "Ada", "last_name": "Lovelace", "preferred_name": "Addy"}
        )
        assert "They prefer to be called Addy." in msg

    def test_omits_preferred_name_when_same_as_first(self):
        msg = patient_identity_message(
            {"first_name": "Ada", "last_name": "Lovelace", "preferred_name": "ada"}
        )
        assert "prefer to be called" not in msg

    def test_includes_date_of_birth(self):
        msg = patient_identity_message(
            {"first_name": "Ada", "date_of_birth": "1990-12-10"}
        )
        assert "Date of birth: 1990-12-10." in msg

    def test_includes_mrn(self):
        msg = patient_identity_message({"first_name": "Ada", "mrn": "MRN-001"})
        assert "Medical record number (MRN): MRN-001." in msg

    def test_dob_only_profile_still_renders(self):
        # No name, but a usable field exists, so it should not be None.
        msg = patient_identity_message({"date_of_birth": "1990-12-10"})
        assert msg is not None
        assert "Date of birth" in msg


class TestStaticPromptConstants:
    def test_system_prompt_identifies_pulse(self):
        assert "Pulse" in PFA_SYSTEM_PROMPT

    def test_system_prompt_carries_safety_guidance(self):
        assert "911" in PFA_SYSTEM_PROMPT

    def test_emergency_keywords_are_lowercase(self):
        assert all(kw == kw.lower() for kw in EMERGENCY_KEYWORDS)

    def test_emergency_reply_mentions_crisis_lines(self):
        assert "911" in EMERGENCY_REPLY and "988" in EMERGENCY_REPLY
