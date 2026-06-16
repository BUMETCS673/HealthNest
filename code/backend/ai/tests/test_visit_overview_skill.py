from __future__ import annotations

from datetime import date
from types import SimpleNamespace

import pytest

from ai.skills.base import SkillContext
from ai.skills.visit_overview_skill import VisitOverviewSkill


class FakeQuery:
    def __init__(self, data):
        self.data = data
        self.filters: list[tuple[str, object]] = []

    def select(self, *args, **kwargs):
        return self

    def eq(self, column, value):
        self.filters.append((column, value))
        return self

    def is_(self, *args, **kwargs):
        return self

    def limit(self, *args, **kwargs):
        return self

    def execute(self):
        return SimpleNamespace(data=self.data)


class FakeAdmin:
    def __init__(self, rows_by_table):
        self.rows_by_table = rows_by_table
        self.queries: dict[str, list[FakeQuery]] = {}

    def table(self, name):
        query = FakeQuery(self.rows_by_table.get(name, []))
        self.queries.setdefault(name, []).append(query)
        return query


@pytest.fixture
def ctx():
    return SkillContext(patient_id="provider-1", user_id="user-1")


def test_list_scopes_appointments_and_omits_unrelated_patients(monkeypatch, ctx):
    today = date.today().isoformat()
    admin = FakeAdmin(
        {
            "appointments": [
                {
                    "id": "allowed",
                    "status": "scheduled",
                    "patient_id": "patient-1",
                    "provider_availability": {
                        "available_date": today,
                        "available_time": "09:00",
                    },
                },
                {
                    "id": "blocked",
                    "status": "scheduled",
                    "patient_id": "patient-2",
                    "provider_availability": {
                        "available_date": today,
                        "available_time": "10:00",
                    },
                },
            ],
            "patients": [
                {"first_name": "Pat", "last_name": "One", "mrn": "MRN-1"}
            ],
        }
    )
    monkeypatch.setattr(
        "ai.skills.visit_overview_skill.get_supabase_admin", lambda: admin
    )
    monkeypatch.setattr(
        "ai.skills.visit_overview_skill.provider_has_active_relationship",
        lambda provider_id, patient_id: patient_id == "patient-1",
    )

    reply = VisitOverviewSkill().run(ctx, op="list", appointment_id=None)

    assert ("provider_id", "provider-1") in admin.queries["appointments"][0].filters
    assert [row["id"] for row in reply.payload["appointments"]] == ["allowed"]
    assert len(admin.queries["patients"]) == 1


def test_detail_scopes_appointment_to_provider(monkeypatch, ctx):
    admin = FakeAdmin({"appointments": []})
    monkeypatch.setattr(
        "ai.skills.visit_overview_skill.get_supabase_admin", lambda: admin
    )

    reply = VisitOverviewSkill().run(
        ctx, op="detail", appointment_id="appointment-1"
    )

    filters = admin.queries["appointments"][0].filters
    assert ("id", "appointment-1") in filters
    assert ("provider_id", "provider-1") in filters
    assert reply.payload == {"visit": None}


def test_detail_rejects_patient_without_active_relationship(monkeypatch, ctx):
    admin = FakeAdmin(
        {
            "appointments": [
                {
                    "id": "appointment-1",
                    "patient_id": "patient-2",
                    "provider_availability": {},
                }
            ]
        }
    )
    monkeypatch.setattr(
        "ai.skills.visit_overview_skill.get_supabase_admin", lambda: admin
    )
    monkeypatch.setattr(
        "ai.skills.visit_overview_skill.provider_has_active_relationship",
        lambda provider_id, patient_id: False,
    )

    reply = VisitOverviewSkill().run(
        ctx, op="detail", appointment_id="appointment-1"
    )

    assert reply.payload == {"visit": None}
    assert "patients" not in admin.queries
