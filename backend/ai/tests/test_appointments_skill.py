"""
AI-USAGE SUMMARY
Tools: Claude (Opus 4.8)
Overall AI Contribution: ~85%
AI-Assisted Areas: Drafted the pytest cases for ai.skills.appointments_skill — the filter branches (upcoming / next / past / on_date / all), the card-row projection, and the summary text.
Human Contributions: Decided to build the fixture dates relative to the real date.today() so the upcoming/past split never goes stale, mocked appointments.service.get_appointments instead of touching Supabase, and verified the summaries / payload shape against the actual skill.
"""

from __future__ import annotations

from datetime import date, timedelta

import pytest

from ai.skills.appointments_skill import (
    AppointmentsSkill,
    _parse_date,
    _sort_key,
    _to_card_row,
)
from ai.skills.base import SkillContext, SkillScope


def _iso(d: date) -> str:
    return d.isoformat()


@pytest.fixture
def appts():
    today = date.today()
    return [
    {
        "id": "a-next",
        "status": "scheduled",
        "providers": {"title": "Dr.", "first_name": "Sam", "last_name": "Smith", "specialty": "Primary Care"},
        "provider_availability": {"available_date": _iso(today + timedelta(days=2)), "available_time": "09:30"},
    },
    {
        "id": "a-later",
        "status": "scheduled",
        "providers": {"title": "Dr.", "first_name": "Jo", "last_name": "Jones", "specialty": "Cardiology"},
        "provider_availability": {"available_date": _iso(today + timedelta(days=10)), "available_time": "14:00"},
    },
    {
        "id": "a-cancelled",
        "status": "cancelled",
        "providers": {"title": "Dr.", "first_name": "Gail", "last_name": "Gray", "specialty": None},
        "provider_availability": {"available_date": _iso(today + timedelta(days=5)), "available_time": "11:00"},
    },
    {
        "id": "a-past",
        "status": "completed",
        "providers": {"title": "Dr.", "first_name": "Val", "last_name": "Vale", "specialty": "Dermatology"},
        "provider_availability": {"available_date": _iso(today - timedelta(days=7)), "available_time": "08:00"},
    },
]


@pytest.fixture
def ctx():
    return SkillContext(patient_id="patient-1", user_id="user-1")


@pytest.fixture
def skill(monkeypatch, appts):
    sk = AppointmentsSkill()
    monkeypatch.setattr(
        "ai.skills.appointments_skill.appointments_service.get_appointments",
        lambda patient_id: appts,
    )
    return sk


class TestDescribe:
    def test_is_patient_facing_only(self):
        spec = AppointmentsSkill().describe()
        assert spec.scope is SkillScope.PFA_ONLY
        assert spec.name == "get_appointments"


class TestRun:
    def test_upcoming_excludes_past_and_cancelled(self, skill, ctx):
        reply = skill.run(ctx, filter="upcoming", date=None)
        ids = [a["id"] for a in reply.payload["appointments"]]
        assert ids == ["a-next", "a-later"]

    def test_upcoming_is_sorted_soonest_first(self, skill, ctx):
        reply = skill.run(ctx, filter="upcoming", date=None)
        ids = [a["id"] for a in reply.payload["appointments"]]
        assert ids[0] == "a-next"

    def test_next_returns_only_the_soonest(self, skill, ctx):
        reply = skill.run(ctx, filter="next", date=None)
        assert len(reply.payload["appointments"]) == 1
        assert reply.payload["appointments"][0]["id"] == "a-next"
        assert "Next appointment: Dr. Sam Smith" in reply.summary

    def test_past_returns_only_past(self, skill, ctx):
        reply = skill.run(ctx, filter="past", date=None)
        ids = [a["id"] for a in reply.payload["appointments"]]
        assert ids == ["a-past"]

    def test_on_date_requires_a_date(self, skill, ctx):
        reply = skill.run(ctx, filter="on_date", date=None)
        assert reply.payload["appointments"] == []
        assert "requires a `date`" in reply.summary

    def test_on_date_matches_exact_day(self, skill, ctx, appts):
        target = appts[0]["provider_availability"]["available_date"]
        reply = skill.run(ctx, filter="on_date", date=target)
        ids = [a["id"] for a in reply.payload["appointments"]]
        assert ids == ["a-next"]

    def test_all_returns_everything(self, skill, ctx):
        reply = skill.run(ctx, filter="all", date=None)
        assert len(reply.payload["appointments"]) == 4

    def test_filter_echoed_into_payload(self, skill, ctx):
        reply = skill.run(ctx, filter="upcoming", date=None)
        assert reply.payload["filter"] == "upcoming"

    def test_next_with_no_upcoming_has_empty_summary(self, monkeypatch, ctx):
        sk = AppointmentsSkill()
        monkeypatch.setattr(
            "ai.skills.appointments_skill.appointments_service.get_appointments",
            lambda patient_id: [],
        )
        reply = sk.run(ctx, filter="next", date=None)
        assert reply.payload["appointments"] == []
        assert "no upcoming" in reply.summary.lower()


class TestHelpers:
    def test_parse_date_reads_iso(self):
        assert _parse_date("2026-06-15") == date(2026, 6, 15)

    def test_parse_date_handles_none(self):
        assert _parse_date(None) is None

    def test_parse_date_handles_garbage(self):
        assert _parse_date("not-a-date") is None

    def test_sort_key_orders_by_date_then_time(self):
        early = {"provider_availability": {"available_date": "2026-06-01", "available_time": "08:00"}}
        late = {"provider_availability": {"available_date": "2026-06-01", "available_time": "09:00"}}
        assert _sort_key(early) < _sort_key(late)

    def test_card_row_projects_expected_fields(self):
        row = _to_card_row(
            {
                "id": "x",
                "status": "scheduled",
                "notes": "n",
                "secret": "should-not-appear",
                "providers": {"title": "Dr.", "first_name": "Alice", "last_name": "Smith", "specialty": "Cardio"},
                "provider_availability": {"available_date": "2026-06-01", "available_time": "08:00"},
            }
        )
        assert "secret" not in row
        assert row["provider_name"] == "Dr. Alice Smith"
