"""
AI-USAGE SUMMARY
Tools: Claude (Opus 4.8)
Overall AI Contribution: ~85%
AI-Assisted Areas: Drafted the pytest cases for ai.skills.book_appointment_skill — the stage branches (confirm / alternatives / choose_time / choose_provider / none), provider-name and specialty matching, and the time/date normalizers.
Human Contributions: Built fixture dates relative to date.today() so the future-slot logic never goes stale, mocked appointments.service.get_availability and providers.service.get_providers instead of touching Supabase, and asserted that every returned option carries both provider.id and slot.availability_id so the card can book without re-fetching.
"""

from __future__ import annotations

from datetime import date, timedelta

import pytest

from ai.skills.base import SkillContext, SkillScope
from ai.skills.book_appointment_skill import (
    BookAppointmentSkill,
    _match_providers,
    _normalize_date,
    _normalize_time,
    _one_option_per_provider,
    _slot_view,
)


def _iso(d: date) -> str:
    return d.isoformat()


SOON = _iso(date.today() + timedelta(days=2))
LATER = _iso(date.today() + timedelta(days=4))


PROVIDERS = [
    {"id": "p-smith", "title": "Dr.", "first_name": "Jane", "last_name": "Smith", "specialty": "Cardiology", "status": "active"},
    {"id": "p-jones", "title": "Dr.", "first_name": "Bob", "last_name": "Jones", "specialty": "Cardiology", "status": "active"},
    {"id": "p-gray", "title": "Dr.", "first_name": "Gail", "last_name": "Gray", "specialty": "Dermatology", "status": "active"},
]


def _slot(sid, pid, d, t):
    prov = next(p for p in PROVIDERS if p["id"] == pid)
    return {
        "id": sid,
        "provider_id": pid,
        "available_date": d,
        "available_time": t,
        "is_booked": False,
        "providers": {
            "title": prov["title"],
            "first_name": prov["first_name"],
            "last_name": prov["last_name"],
            "specialty": prov["specialty"],
        },
    }


AVAIL = [
    _slot("s-smith-9", "p-smith", SOON, "09:00"),
    _slot("s-smith-10", "p-smith", SOON, "10:00"),
    _slot("s-jones-9", "p-jones", SOON, "09:00"),
    _slot("s-gray-later", "p-gray", LATER, "13:00"),
]


@pytest.fixture
def ctx():
    return SkillContext(patient_id="patient-1", user_id="user-1")


@pytest.fixture
def skill(monkeypatch):
    sk = BookAppointmentSkill()
    monkeypatch.setattr(
        "ai.skills.book_appointment_skill.appointments_service.get_availability",
        lambda: AVAIL,
    )
    monkeypatch.setattr(
        "ai.skills.book_appointment_skill.providers_service.get_providers",
        lambda: PROVIDERS,
    )
    return sk


class TestDescribe:
    def test_is_patient_facing_only(self):
        spec = BookAppointmentSkill().describe()
        assert spec.scope is SkillScope.PFA_ONLY
        assert spec.name == "book_appointment"

    def test_all_params_optional_but_required_by_schema(self):
        # OpenAI strict mode requires every property listed in `required`.
        spec = BookAppointmentSkill().describe()
        props = set(spec.parameters["properties"])
        assert set(spec.parameters["required"]) == props


class TestConfirmStage:
    def test_exact_provider_date_time_confirms(self, skill, ctx):
        reply = skill.run(
            ctx, provider_name="Smith", specialty=None, date=SOON, time="09:00", notes=None
        )
        assert reply.payload["stage"] == "confirm"
        assert reply.payload["provider"]["id"] == "p-smith"
        assert reply.payload["slot"]["availability_id"] == "s-smith-9"

    def test_confirm_carries_notes(self, skill, ctx):
        reply = skill.run(
            ctx, provider_name="Smith", specialty=None, date=SOON, time="09:00", notes="annual checkup"
        )
        assert reply.payload["notes"] == "annual checkup"

    def test_lenient_time_format_still_confirms(self, skill, ctx):
        reply = skill.run(
            ctx, provider_name="Smith", specialty=None, date=SOON, time="9am", notes=None
        )
        assert reply.payload["stage"] == "confirm"
        assert reply.payload["slot"]["availability_id"] == "s-smith-9"


class TestAlternativesStage:
    def test_provider_busy_offers_other_times_and_providers(self, skill, ctx):
        # Smith has no 14:00 slot, but does have other times; Jones is free at 09:00.
        reply = skill.run(
            ctx, provider_name="Smith", specialty=None, date=SOON, time="14:00", notes=None
        )
        assert reply.payload["stage"] == "alternatives"
        assert reply.payload["provider"]["id"] == "p-smith"
        # Smith's other open times are offered.
        their_ids = {s["availability_id"] for s in reply.payload["provider_slots"]}
        assert their_ids == {"s-smith-9", "s-smith-10"}

    def test_other_providers_at_requested_time(self, skill, ctx):
        # Smith not free at 09:00? She is — so ask for a time she's NOT free
        # but Jones is. Both are free at 09:00, so use a time only Jones has.
        reply = skill.run(
            ctx, provider_name="Jones", specialty=None, date=SOON, time="10:00", notes=None
        )
        assert reply.payload["stage"] == "alternatives"
        others = {o["provider"]["id"] for o in reply.payload["other_providers"]}
        assert "p-smith" in others  # Smith is free at 10:00

    def test_only_provider_has_other_times_no_other_providers(self, skill, ctx, monkeypatch):
        # Only Gray, far out; ask Gray for a time she does not have and nobody else does.
        monkeypatch.setattr(
            "ai.skills.book_appointment_skill.appointments_service.get_availability",
            lambda: [_slot("s-gray-later", "p-gray", LATER, "13:00")],
        )
        reply = skill.run(
            ctx, provider_name="Gray", specialty=None, date=SOON, time="07:00", notes=None
        )
        # Gray still has another time, so this is alternatives, not none.
        assert reply.payload["stage"] == "alternatives"
        assert reply.payload["other_providers"] == []


class TestChooseTimeStage:
    def test_provider_no_time_lists_their_slots(self, skill, ctx):
        reply = skill.run(
            ctx, provider_name="Smith", specialty=None, date=None, time=None, notes=None
        )
        assert reply.payload["stage"] == "choose_time"
        assert reply.payload["provider"]["id"] == "p-smith"
        ids = {s["availability_id"] for s in reply.payload["slots"]}
        assert ids == {"s-smith-9", "s-smith-10"}

    def test_provider_and_date_no_time_lists_only_that_days_slots(self, skill, ctx, monkeypatch):
        # "schedule with <provider> tomorrow" — provider + date, no time.
        # Should return that provider's open times scoped to the requested day.
        avail = AVAIL + [_slot("s-smith-later", "p-smith", LATER, "11:00")]
        monkeypatch.setattr(
            "ai.skills.book_appointment_skill.appointments_service.get_availability",
            lambda: avail,
        )
        reply = skill.run(
            ctx, provider_name="Smith", specialty=None, date=SOON, time=None, notes=None
        )
        assert reply.payload["stage"] == "choose_time"
        assert reply.payload["provider"]["id"] == "p-smith"
        ids = {s["availability_id"] for s in reply.payload["slots"]}
        # Only SOON slots — the LATER slot is excluded by the date filter.
        assert ids == {"s-smith-9", "s-smith-10"}

    def test_provider_with_no_slots_falls_back_to_choose_provider(self, skill, ctx, monkeypatch):
        # Add a provider with zero availability.
        provs = PROVIDERS + [
            {"id": "p-new", "title": "Dr.", "first_name": "New", "last_name": "Doc", "specialty": "Neurology", "status": "active"}
        ]
        monkeypatch.setattr(
            "ai.skills.book_appointment_skill.providers_service.get_providers",
            lambda: provs,
        )
        reply = skill.run(
            ctx, provider_name="New Doc", specialty=None, date=None, time=None, notes=None
        )
        assert reply.payload["stage"] == "choose_provider"


class TestChooseProviderStage:
    def test_no_provider_lists_one_option_each(self, skill, ctx):
        reply = skill.run(
            ctx, provider_name=None, specialty=None, date=None, time=None, notes=None
        )
        assert reply.payload["stage"] == "choose_provider"
        provider_ids = {o["provider"]["id"] for o in reply.payload["options"]}
        assert provider_ids == {"p-smith", "p-jones", "p-gray"}

    def test_options_carry_provider_and_slot_ids(self, skill, ctx):
        reply = skill.run(
            ctx, provider_name=None, specialty=None, date=None, time=None, notes=None
        )
        for opt in reply.payload["options"]:
            assert opt["provider"]["id"]
            assert opt["slot"]["availability_id"]

    def test_date_time_scopes_to_providers_at_that_time(self, skill, ctx):
        reply = skill.run(
            ctx, provider_name=None, specialty=None, date=SOON, time="09:00", notes=None
        )
        assert reply.payload["stage"] == "choose_provider"
        provider_ids = {o["provider"]["id"] for o in reply.payload["options"]}
        assert provider_ids == {"p-smith", "p-jones"}

    def test_unknown_provider_name_falls_back_with_note(self, skill, ctx):
        reply = skill.run(
            ctx, provider_name="Nonexistent", specialty=None, date=None, time=None, notes=None
        )
        assert reply.payload["stage"] == "choose_provider"
        assert "couldn't find" in reply.summary.lower()

    def test_specialty_with_multiple_matches_disambiguates(self, skill, ctx):
        reply = skill.run(
            ctx, provider_name=None, specialty="Cardiology", date=None, time=None, notes=None
        )
        assert reply.payload["stage"] == "choose_provider"
        provider_ids = {o["provider"]["id"] for o in reply.payload["options"]}
        assert provider_ids == {"p-smith", "p-jones"}

    def test_no_provider_at_requested_time_falls_back_to_soonest(self, skill, ctx):
        reply = skill.run(
            ctx, provider_name=None, specialty=None, date=SOON, time="23:00", notes=None
        )
        assert reply.payload["stage"] == "choose_provider"
        assert "soonest" in reply.summary.lower()


class TestNoneStage:
    def test_no_availability_returns_none(self, ctx, monkeypatch):
        sk = BookAppointmentSkill()
        monkeypatch.setattr(
            "ai.skills.book_appointment_skill.appointments_service.get_availability",
            lambda: [],
        )
        monkeypatch.setattr(
            "ai.skills.book_appointment_skill.providers_service.get_providers",
            lambda: PROVIDERS,
        )
        reply = sk.run(
            ctx, provider_name=None, specialty=None, date=None, time=None, notes=None
        )
        assert reply.payload["stage"] == "none"


class TestHelpers:
    @pytest.mark.parametrize(
        "raw,expected",
        [
            ("9", "09:00"),
            ("9:00", "09:00"),
            ("09:00", "09:00"),
            ("9am", "09:00"),
            ("9:30 PM", "21:30"),
            ("12am", "00:00"),
            ("12pm", "12:00"),
            ("14:00", "14:00"),
            ("14:00:00", "14:00"),
        ],
    )
    def test_normalize_time(self, raw, expected):
        assert _normalize_time(raw) == expected

    @pytest.mark.parametrize("raw", [None, "", "not-a-time", "25:00", "9:99"])
    def test_normalize_time_rejects_garbage(self, raw):
        assert _normalize_time(raw) is None

    def test_normalize_date_reads_iso(self):
        assert _normalize_date("2026-06-15") == "2026-06-15"

    def test_normalize_date_handles_garbage(self):
        assert _normalize_date("nope") is None

    def test_match_providers_by_last_name(self):
        out = _match_providers(PROVIDERS, "Smith", None)
        assert [p["id"] for p in out] == ["p-smith"]

    def test_match_providers_strips_honorific(self):
        out = _match_providers(PROVIDERS, "Dr. Smith", None)
        assert [p["id"] for p in out] == ["p-smith"]

    def test_match_providers_by_specialty(self):
        out = _match_providers(PROVIDERS, None, "cardiology")
        assert {p["id"] for p in out} == {"p-smith", "p-jones"}

    def test_match_providers_empty_when_no_query(self):
        assert _match_providers(PROVIDERS, None, None) == []

    def test_slot_view_shape(self):
        view = _slot_view(AVAIL[0])
        assert view == {"availability_id": "s-smith-9", "date": SOON, "time": "09:00"}

    def test_one_option_per_provider_dedupes(self):
        opts = _one_option_per_provider(AVAIL)
        ids = [o["provider"]["id"] for o in opts]
        assert len(ids) == len(set(ids))
        # Smith's earliest (09:00) is the one kept.
        smith = next(o for o in opts if o["provider"]["id"] == "p-smith")
        assert smith["slot"]["availability_id"] == "s-smith-9"
