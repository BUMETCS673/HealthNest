# AI-USAGE SUMMARY
# Tools: Claude Code (Opus 4.8)
# Overall AI Contribution: ~75%
# AI-Assisted Areas: Tests for provider scheduling — 30-minute slot generation,
#   weekday/end-date recurrence expansion, the add-availability endpoint, and
#   provider-initiated booking (slot created + marked booked).
# Human Contributions: Test cases and expectations.
# Notes: Validated via pytest.
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from main import app
from auth.deps import current_provider_id
from scheduling import service
from scheduling.schemas import AvailabilityCreate

FAKE_PROVIDER_ID = "pppppppp-0000-0000-0000-000000000001"


# ── pure slot / recurrence logic ───────────────────────────────────────────
def test_slot_times_half_hour_increments():
    # 2:00pm–4:00pm => four 30-minute slots
    assert service._slot_times("14:00", "16:00") == [
        "14:00:00",
        "14:30:00",
        "15:00:00",
        "15:30:00",
    ]


def test_slot_times_rejects_inverted_range():
    with pytest.raises(HTTPException):
        service._slot_times("16:00", "14:00")


def test_target_dates_single_day_without_weekdays():
    payload = AvailabilityCreate(
        start_date="2026-06-15", start_time="09:00", end_time="10:00"
    )
    assert service._target_dates(payload) == ["2026-06-15"]


def test_target_dates_recurring_only_selected_weekdays_in_window():
    payload = AvailabilityCreate(
        start_date="2026-06-15",
        start_time="09:00",
        end_time="10:00",
        weekdays=[0, 2],  # Mondays + Wednesdays
        end_date="2026-06-28",
    )
    dates = service._target_dates(payload)
    assert dates == sorted(dates)
    assert dates  # non-empty
    for d in dates:
        wd = datetime.strptime(d, "%Y-%m-%d").weekday()
        assert wd in (0, 2)
        assert "2026-06-15" <= d <= "2026-06-28"


def test_target_dates_recurring_requires_end_date():
    payload = AvailabilityCreate(
        start_date="2026-06-15",
        start_time="09:00",
        end_time="10:00",
        weekdays=[0],
    )
    with pytest.raises(HTTPException):
        service._target_dates(payload)


# ── endpoints ───────────────────────────────────────────────────────────────
def test_add_availability_generates_and_inserts_slots():
    app.dependency_overrides[current_provider_id] = lambda: FAKE_PROVIDER_ID
    admin = MagicMock()
    tbl = admin.table.return_value
    tbl.select.return_value.eq.return_value.in_.return_value.execute.return_value.data = []
    tbl.insert.return_value.execute.return_value.data = [
        {"id": "s1", "available_date": "2026-06-15", "available_time": "09:00:00", "is_booked": False},
        {"id": "s2", "available_date": "2026-06-15", "available_time": "09:30:00", "is_booked": False},
    ]
    try:
        with patch("scheduling.service.get_supabase_admin", return_value=admin):
            with TestClient(app) as c:
                resp = c.post(
                    "/schedule/availability",
                    json={"start_date": "2026-06-15", "start_time": "09:00", "end_time": "10:00"},
                )
        assert resp.status_code == 201
        assert len(resp.json()) == 2
        rows = tbl.insert.call_args.args[0]
        assert [r["available_time"] for r in rows] == ["09:00:00", "09:30:00"]
        assert all(r["provider_id"] == FAKE_PROVIDER_ID and r["is_booked"] is False for r in rows)
    finally:
        app.dependency_overrides.clear()


def test_create_appointment_creates_booked_slot_and_appointment():
    app.dependency_overrides[current_provider_id] = lambda: FAKE_PROVIDER_ID

    rel_tbl = MagicMock()
    rel_tbl.select.return_value.eq.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value.data = [
        {"id": "rel-1"}
    ]

    avail_tbl = MagicMock()
    avail_tbl.select.return_value.eq.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value.data = []
    avail_tbl.insert.return_value.execute.return_value.data = [{"id": "slot-new"}]

    appt_tbl = MagicMock()
    appt_tbl.insert.return_value.execute.return_value.data = [
        {
            "id": "appt-1",
            "patient_id": "pat-1",
            "provider_id": FAKE_PROVIDER_ID,
            "availability_id": "slot-new",
            "status": "scheduled",
            "notes": None,
        }
    ]

    admin = MagicMock()
    admin.table.side_effect = lambda name: {
        "patient_provider_relationships": rel_tbl,
        "provider_availability": avail_tbl,
        "appointments": appt_tbl,
    }[name]

    try:
        with patch("scheduling.service.get_supabase_admin", return_value=admin):
            with TestClient(app) as c:
                resp = c.post(
                    "/schedule/appointments",
                    json={"patient_id": "pat-1", "date": "2026-06-15", "time": "09:00"},
                )
        assert resp.status_code == 201
        body = resp.json()
        assert body["id"] == "appt-1"
        assert body["availability_id"] == "slot-new"
        # the freshly-created slot must be booked
        assert avail_tbl.insert.call_args.args[0]["is_booked"] is True
    finally:
        app.dependency_overrides.clear()


def test_materialize_rules_generates_future_weekday_slots():
    rule = {
        "weekday": 0,  # Monday
        "start_time": "09:00:00",
        "end_time": "10:00:00",
        "effective_from": (datetime.now().date() - timedelta(days=1)).isoformat(),
        "effective_until": None,  # indefinite
    }
    rules_tbl = MagicMock()
    rules_tbl.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [rule]

    avail_tbl = MagicMock()
    avail_tbl.select.return_value.eq.return_value.gte.return_value.lte.return_value.execute.return_value.data = []
    avail_tbl.insert.return_value.execute.return_value.data = []

    admin = MagicMock()
    admin.table.side_effect = lambda name: {
        "availability_rules": rules_tbl,
        "provider_availability": avail_tbl,
    }[name]

    with patch("scheduling.service.get_supabase_admin", return_value=admin):
        service.materialize_rules("prov-1")

    assert avail_tbl.insert.called
    rows = avail_tbl.insert.call_args.args[0]
    assert len(rows) > 0
    assert all(r["available_time"] in ("09:00:00", "09:30:00") for r in rows)
    assert all(
        datetime.strptime(r["available_date"], "%Y-%m-%d").weekday() == 0 for r in rows
    )
    assert all(r["is_booked"] is False for r in rows)


def test_add_recurrence_rule_endpoint_creates_rule_and_materializes():
    app.dependency_overrides[current_provider_id] = lambda: FAKE_PROVIDER_ID

    rules_tbl = MagicMock()
    rules_tbl.insert.return_value.execute.return_value.data = [
        {
            "id": "rule-1",
            "weekday": 0,
            "start_time": "09:00:00",
            "end_time": "10:00:00",
            "effective_from": "2026-06-15",
            "effective_until": None,
            "active": True,
        }
    ]
    rules_tbl.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
        {
            "weekday": 0,
            "start_time": "09:00:00",
            "end_time": "10:00:00",
            "effective_from": "2026-06-15",
            "effective_until": None,
        }
    ]

    avail_tbl = MagicMock()
    avail_tbl.select.return_value.eq.return_value.gte.return_value.lte.return_value.execute.return_value.data = []
    avail_tbl.insert.return_value.execute.return_value.data = []

    admin = MagicMock()
    admin.table.side_effect = lambda name: {
        "availability_rules": rules_tbl,
        "provider_availability": avail_tbl,
    }[name]

    try:
        with patch("scheduling.service.get_supabase_admin", return_value=admin):
            with TestClient(app) as c:
                resp = c.post(
                    "/schedule/rules",
                    json={"weekdays": [0], "start_time": "09:00", "end_time": "10:00"},
                )
        assert resp.status_code == 201
        assert resp.json()[0]["id"] == "rule-1"
        assert avail_tbl.insert.called  # materialized concrete slots
    finally:
        app.dependency_overrides.clear()


def test_create_appointment_rejects_non_care_team_patient():
    app.dependency_overrides[current_provider_id] = lambda: FAKE_PROVIDER_ID

    rel_tbl = MagicMock()
    rel_tbl.select.return_value.eq.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value.data = []
    admin = MagicMock()
    admin.table.side_effect = lambda name: rel_tbl

    try:
        with patch("scheduling.service.get_supabase_admin", return_value=admin):
            with TestClient(app) as c:
                resp = c.post(
                    "/schedule/appointments",
                    json={"patient_id": "stranger", "date": "2026-06-15", "time": "09:00"},
                )
        assert resp.status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_set_slot_blocks_a_new_time():
    app.dependency_overrides[current_provider_id] = lambda: FAKE_PROVIDER_ID
    avail = MagicMock()
    avail.select.return_value.eq.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value.data = []
    avail.insert.return_value.execute.return_value.data = [{"id": "slot-x"}]
    admin = MagicMock()
    admin.table.return_value = avail
    try:
        with patch("scheduling.service.get_supabase_admin", return_value=admin):
            with TestClient(app) as c:
                resp = c.post(
                    "/schedule/slot",
                    json={"date": "2026-06-20", "time": "14:00", "state": "blocked"},
                )
        assert resp.status_code == 200
        assert resp.json()["blocked"] is True
        assert avail.insert.call_args.args[0]["blocked"] is True
    finally:
        app.dependency_overrides.clear()


def test_set_slot_opens_existing_slot():
    app.dependency_overrides[current_provider_id] = lambda: FAKE_PROVIDER_ID
    avail = MagicMock()
    avail.select.return_value.eq.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value.data = [
        {"id": "slot-1", "is_booked": False}
    ]
    admin = MagicMock()
    admin.table.return_value = avail
    try:
        with patch("scheduling.service.get_supabase_admin", return_value=admin):
            with TestClient(app) as c:
                resp = c.post(
                    "/schedule/slot",
                    json={"date": "2026-06-20", "time": "14:00", "state": "open"},
                )
        assert resp.status_code == 200
        assert resp.json()["blocked"] is False
        avail.update.assert_called_with({"blocked": False})
    finally:
        app.dependency_overrides.clear()


def test_set_slot_rejects_booked_time():
    app.dependency_overrides[current_provider_id] = lambda: FAKE_PROVIDER_ID
    avail = MagicMock()
    avail.select.return_value.eq.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value.data = [
        {"id": "slot-1", "is_booked": True}
    ]
    admin = MagicMock()
    admin.table.return_value = avail
    try:
        with patch("scheduling.service.get_supabase_admin", return_value=admin):
            with TestClient(app) as c:
                resp = c.post(
                    "/schedule/slot",
                    json={"date": "2026-06-20", "time": "14:00", "state": "blocked"},
                )
        assert resp.status_code == 409
    finally:
        app.dependency_overrides.clear()


def test_cancel_appointment_removes_appointment_and_slot():
    app.dependency_overrides[current_provider_id] = lambda: FAKE_PROVIDER_ID
    appt_tbl = MagicMock()
    appt_tbl.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = [
        {"id": "appt-1", "provider_id": FAKE_PROVIDER_ID, "availability_id": "slot-1"}
    ]
    avail_tbl = MagicMock()
    admin = MagicMock()
    admin.table.side_effect = lambda name: {
        "appointments": appt_tbl,
        "provider_availability": avail_tbl,
    }[name]
    try:
        with patch("scheduling.service.get_supabase_admin", return_value=admin):
            with TestClient(app) as c:
                resp = c.post("/schedule/appointments/appt-1/cancel")
        assert resp.status_code == 204
        appt_tbl.delete.assert_called()  # appointment removed first
        avail_tbl.delete.assert_called()  # then its slot
    finally:
        app.dependency_overrides.clear()


def test_cancel_appointment_rejects_other_providers():
    app.dependency_overrides[current_provider_id] = lambda: FAKE_PROVIDER_ID
    appt_tbl = MagicMock()
    appt_tbl.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = [
        {"id": "appt-1", "provider_id": "someone-else", "availability_id": "slot-1"}
    ]
    admin = MagicMock()
    admin.table.return_value = appt_tbl
    try:
        with patch("scheduling.service.get_supabase_admin", return_value=admin):
            with TestClient(app) as c:
                resp = c.post("/schedule/appointments/appt-1/cancel")
        assert resp.status_code == 404
    finally:
        app.dependency_overrides.clear()
