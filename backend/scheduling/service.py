# AI-USAGE SUMMARY
# Tools: Claude Code (Opus 4.8)
# Overall AI Contribution: ~80%
# AI-Assisted Areas: Provider scheduling service — 30-minute slot generation,
#   weekday/end-date recurrence expansion, duplicate-skip on insert, open-slot
#   listing/deletion, the provider's patient list, and provider-initiated
#   appointment creation (reuse-or-create the slot, then book it). Booking now
#   self-heals orphaned slots: a slot flagged booked is only rejected when a
#   live (non-cancelled) appointment actually references it, otherwise it is
#   reused. Cancelling removes the appointment and its slot, then sweeps any
#   duplicate slots at the same date/time with no live appointment so a leftover
#   booked duplicate can't block materialize_rules from re-opening the slot
#   (which had left it stuck white and unbookable).
# Human Contributions: Business rules (fixed 30-min slots, can't delete a booked
#   slot, patient must be on the provider's care team); reported the stuck-slot /
#   "already booked" bug after a cancel; verification.
# Notes: Validated via pytest. Backend runs uvicorn without --reload, so these
#   changes require `docker compose restart backend` to take effect.
from datetime import datetime, timedelta
from typing import Any

from fastapi import HTTPException, status
from auth.client import get_supabase_admin

from .schemas import (
    AvailabilityCreate,
    ProviderAppointmentCreate,
    RecurrenceRuleCreate,
)

SLOT_MINUTES = 30
# How far ahead recurring rules are materialized into concrete slots. Rules are
# "indefinite" (no end date); we keep a rolling ~10-week window of real slots so
# the existing patient-booking flow (which books a concrete slot) keeps working.
HORIZON_DAYS = 70


def _slot_times(start_time: str, end_time: str) -> list[str]:
    """30-minute start times in [start_time, end_time) as HH:MM:SS."""
    start = datetime.strptime(start_time[:5], "%H:%M")
    end = datetime.strptime(end_time[:5], "%H:%M")
    if end <= start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End time must be after start time.",
        )
    times: list[str] = []
    t = start
    while t < end:
        times.append(t.strftime("%H:%M:%S"))
        t += timedelta(minutes=SLOT_MINUTES)
    return times


def _target_dates(payload: AvailabilityCreate) -> list[str]:
    """The dates to add slots for (single day, or every matching weekday)."""
    start = datetime.strptime(payload.start_date, "%Y-%m-%d").date()
    if not payload.weekdays:
        return [start.isoformat()]

    if not payload.end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="end_date is required for recurring availability.",
        )
    end = datetime.strptime(payload.end_date, "%Y-%m-%d").date()
    if end < start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="end_date must be on or after start_date.",
        )
    wanted = set(payload.weekdays)
    dates: list[str] = []
    day = start
    while day <= end:
        if day.weekday() in wanted:
            dates.append(day.isoformat())
        day += timedelta(days=1)
    return dates


def add_availability(provider_id: str, payload: AvailabilityCreate) -> list[dict[str, Any]]:
    dates = _target_dates(payload)
    times = _slot_times(payload.start_time, payload.end_time)
    if not dates or not times:
        return []

    admin = get_supabase_admin()
    existing = (
        admin.table("provider_availability")
        .select("available_date, available_time")
        .eq("provider_id", provider_id)
        .in_("available_date", dates)
        .execute()
    )
    have = {
        (r["available_date"], str(r["available_time"])[:8])
        for r in (existing.data or [])
    }

    rows = [
        {
            "provider_id": provider_id,
            "available_date": d,
            "available_time": t,
            "is_booked": False,
        }
        for d in dates
        for t in times
        if (d, t) not in have
    ]
    if not rows:
        return []

    result = admin.table("provider_availability").insert(rows).execute()
    return result.data


def get_availability(provider_id: str) -> list[dict[str, Any]]:
    """The provider's slots from today forward, ordered by date then time.

    Tops up recurring-rule slots first so the rolling window stays filled.
    """
    materialize_rules(provider_id)
    today = datetime.now().date().isoformat()
    result = (
        get_supabase_admin()
        .table("provider_availability")
        .select("id, available_date, available_time, is_booked, blocked")
        .eq("provider_id", provider_id)
        .gte("available_date", today)
        .order("available_date")
        .order("available_time")
        .execute()
    )
    return result.data


def set_slot_state(provider_id: str, date: str, time: str, state: str) -> dict[str, Any]:
    """Open or block a single slot (calendar override of the office-hours baseline).

    state="open"  -> available (also used to unblock)
    state="blocked" -> unavailable; survives rule materialization.
    """
    if state not in ("open", "blocked"):
        raise HTTPException(status_code=400, detail="Invalid slot state.")
    blocked = state == "blocked"
    time_full = time if len(time) > 5 else f"{time}:00"
    admin = get_supabase_admin()

    existing = (
        admin.table("provider_availability")
        .select("id, is_booked")
        .eq("provider_id", provider_id)
        .eq("available_date", date)
        .eq("available_time", time_full)
        .limit(1)
        .execute()
    )
    if existing.data:
        slot = existing.data[0]
        if slot["is_booked"]:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="That slot is already booked.",
            )
        admin.table("provider_availability").update({"blocked": blocked}).eq(
            "id", slot["id"]
        ).execute()
        slot_id = slot["id"]
    else:
        created = (
            admin.table("provider_availability")
            .insert(
                {
                    "provider_id": provider_id,
                    "available_date": date,
                    "available_time": time_full,
                    "is_booked": False,
                    "blocked": blocked,
                }
            )
            .execute()
        )
        slot_id = created.data[0]["id"]

    return {
        "id": slot_id,
        "available_date": date,
        "available_time": time_full,
        "is_booked": False,
        "blocked": blocked,
    }


def delete_availability(provider_id: str, slot_id: str) -> None:
    admin = get_supabase_admin()
    slot = (
        admin.table("provider_availability")
        .select("id, provider_id, is_booked")
        .eq("id", slot_id)
        .limit(1)
        .execute()
    )
    rows = slot.data or []
    if not rows or rows[0]["provider_id"] != provider_id:
        raise HTTPException(status_code=404, detail="Availability slot not found.")
    if rows[0]["is_booked"]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot remove a slot that is already booked.",
        )
    admin.table("provider_availability").delete().eq("id", slot_id).execute()


def get_recurrence_rules(provider_id: str) -> list[dict[str, Any]]:
    result = (
        get_supabase_admin()
        .table("availability_rules")
        .select("id, weekday, start_time, end_time, effective_from, effective_until, active")
        .eq("provider_id", provider_id)
        .eq("active", True)
        .order("weekday")
        .order("start_time")
        .execute()
    )
    return result.data


def add_recurrence_rule(provider_id: str, payload: RecurrenceRuleCreate) -> list[dict[str, Any]]:
    """Create one rule row per selected weekday, then materialize concrete slots."""
    # validate the time range up front
    _slot_times(payload.start_time, payload.end_time)
    if not payload.weekdays:
        raise HTTPException(status_code=400, detail="Select at least one weekday.")

    eff_from = payload.effective_from or datetime.now().date().isoformat()
    rows = [
        {
            "provider_id": provider_id,
            "weekday": wd,
            "start_time": payload.start_time if len(payload.start_time) > 5 else f"{payload.start_time}:00",
            "end_time": payload.end_time if len(payload.end_time) > 5 else f"{payload.end_time}:00",
            "effective_from": eff_from,
            "effective_until": payload.effective_until,
            "active": True,
        }
        for wd in sorted(set(payload.weekdays))
    ]
    created = get_supabase_admin().table("availability_rules").insert(rows).execute()
    materialize_rules(provider_id)
    return created.data


def delete_recurrence_rule(provider_id: str, rule_id: str) -> None:
    admin = get_supabase_admin()
    found = (
        admin.table("availability_rules")
        .select("id, provider_id, weekday, start_time, end_time")
        .eq("id", rule_id)
        .limit(1)
        .execute()
    )
    rows = found.data or []
    if not rows or rows[0]["provider_id"] != provider_id:
        raise HTTPException(status_code=404, detail="Recurrence rule not found.")
    rule = rows[0]

    # Remove future, still-open slots this rule produced (match weekday + time).
    today = datetime.now().date().isoformat()
    future = (
        admin.table("provider_availability")
        .select("id, available_date, available_time")
        .eq("provider_id", provider_id)
        .eq("is_booked", False)
        .gte("available_date", today)
        .execute()
    )
    rule_times = set(_slot_times(str(rule["start_time"])[:5], str(rule["end_time"])[:5]))
    stale_ids = [
        s["id"]
        for s in (future.data or [])
        if datetime.strptime(s["available_date"], "%Y-%m-%d").date().weekday() == rule["weekday"]
        and str(s["available_time"])[:8] in rule_times
    ]
    if stale_ids:
        admin.table("provider_availability").delete().in_("id", stale_ids).execute()
    admin.table("availability_rules").delete().eq("id", rule_id).execute()


def materialize_rules(provider_id: str) -> None:
    """Generate concrete slots for active rules across the rolling horizon."""
    admin = get_supabase_admin()
    rules = (
        admin.table("availability_rules")
        .select("weekday, start_time, end_time, effective_from, effective_until")
        .eq("provider_id", provider_id)
        .eq("active", True)
        .execute()
    )
    if not rules.data:
        return

    today = datetime.now().date()
    horizon = today + timedelta(days=HORIZON_DAYS)

    existing = (
        admin.table("provider_availability")
        .select("available_date, available_time")
        .eq("provider_id", provider_id)
        .gte("available_date", today.isoformat())
        .lte("available_date", horizon.isoformat())
        .execute()
    )
    have = {
        (r["available_date"], str(r["available_time"])[:8])
        for r in (existing.data or [])
    }

    rows: list[dict[str, Any]] = []
    for rule in rules.data:
        weekday = rule["weekday"]
        eff_from = datetime.strptime(rule["effective_from"], "%Y-%m-%d").date()
        eff_until = (
            datetime.strptime(rule["effective_until"], "%Y-%m-%d").date()
            if rule.get("effective_until")
            else horizon
        )
        start = max(today, eff_from)
        end = min(horizon, eff_until)
        times = _slot_times(str(rule["start_time"])[:5], str(rule["end_time"])[:5])
        day = start
        while day <= end:
            if day.weekday() == weekday:
                ds = day.isoformat()
                for t in times:
                    if (ds, t) not in have:
                        rows.append(
                            {
                                "provider_id": provider_id,
                                "available_date": ds,
                                "available_time": t,
                                "is_booked": False,
                            }
                        )
                        have.add((ds, t))
            day += timedelta(days=1)

    if rows:
        admin.table("provider_availability").insert(rows).execute()


def get_patients(provider_id: str) -> list[dict[str, Any]]:
    """The provider's active-relationship patients (for the booking picker)."""
    admin = get_supabase_admin()
    rels = (
        admin.table("patient_provider_relationships")
        .select("patient_id")
        .eq("provider_id", provider_id)
        .eq("status", "active")
        .execute()
    )
    ids = [r["patient_id"] for r in (rels.data or [])]
    if not ids:
        return []
    pats = (
        admin.table("patients")
        .select("id, first_name, last_name")
        .in_("id", ids)
        .order("last_name")
        .execute()
    )
    return pats.data


def get_appointments(provider_id: str) -> list[dict[str, Any]]:
    """The provider's appointments with patient name + slot time."""
    result = (
        get_supabase_admin()
        .table("appointments")
        .select(
            """
            id, patient_id, availability_id, status, notes,
            patients ( first_name, last_name, user_id ),
            provider_availability ( available_date, available_time )
            """
        )
        .eq("provider_id", provider_id)
        .neq("status", "cancelled")
        .execute()
    )
    out: list[dict[str, Any]] = []
    for a in (result.data or []):
        slot = a.get("provider_availability") or {}
        patient = a.get("patients") or {}
        name = f"{patient.get('first_name', '')} {patient.get('last_name', '')}".strip()
        out.append(
            {
                "id": a["id"],
                "patient_id": a["patient_id"],
                "patient_user_id": patient.get("user_id"),
                "patient_name": name or None,
                "availability_id": a["availability_id"],
                "status": a["status"],
                "notes": a.get("notes"),
                "available_date": slot.get("available_date"),
                "available_time": slot.get("available_time"),
            }
        )
    out.sort(key=lambda x: (x["available_date"] or "", x["available_time"] or ""))
    return out


def cancel_appointment(provider_id: str, appointment_id: str) -> None:
    """Cancel one of the provider's appointments and remove its slot.

    The appointment row is removed first (it FKs the slot), then the slot. An
    office-hours slot is re-created as open by materialize_rules on the next
    read; a one-off (outside office hours) slot simply disappears instead of
    lingering as a stray open slot.
    """
    admin = get_supabase_admin()
    found = (
        admin.table("appointments")
        .select("id, provider_id, availability_id")
        .eq("id", appointment_id)
        .limit(1)
        .execute()
    )
    rows = found.data or []
    if not rows or rows[0]["provider_id"] != provider_id:
        raise HTTPException(status_code=404, detail="Appointment not found.")

    admin.table("appointments").delete().eq("id", appointment_id).execute()

    slot_id = rows[0].get("availability_id")
    if not slot_id:
        return

    # Note the slot's date/time before deleting so we can also sweep any
    # duplicate slots at the same time. A leftover booked duplicate would block
    # materialize_rules from re-opening the slot (it would linger white and
    # unbookable), so remove same-time slots that have no live appointment.
    slot = (
        admin.table("provider_availability")
        .select("available_date, available_time")
        .eq("id", slot_id)
        .limit(1)
        .execute()
    )
    admin.table("provider_availability").delete().eq("id", slot_id).execute()

    if not slot.data:
        return
    same_time = (
        admin.table("provider_availability")
        .select("id")
        .eq("provider_id", provider_id)
        .eq("available_date", slot.data[0]["available_date"])
        .eq("available_time", slot.data[0]["available_time"])
        .execute()
    )
    for s in same_time.data or []:
        live = (
            admin.table("appointments")
            .select("id")
            .eq("availability_id", s["id"])
            .neq("status", "cancelled")
            .limit(1)
            .execute()
        )
        if not live.data:
            admin.table("provider_availability").delete().eq("id", s["id"]).execute()


def create_appointment(provider_id: str, payload: ProviderAppointmentCreate) -> dict[str, Any]:
    """Provider books one of their patients at a date/time.

    Reuses an existing open slot at that time, otherwise creates one; then marks
    it booked and creates the appointment.
    """
    admin = get_supabase_admin()
    time_full = payload.time if len(payload.time) > 5 else f"{payload.time}:00"

    rel = (
        admin.table("patient_provider_relationships")
        .select("id")
        .eq("provider_id", provider_id)
        .eq("patient_id", payload.patient_id)
        .eq("status", "active")
        .limit(1)
        .execute()
    )
    if not rel.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Patient is not on your care team.",
        )

    existing = (
        admin.table("provider_availability")
        .select("id, is_booked")
        .eq("provider_id", provider_id)
        .eq("available_date", payload.date)
        .eq("available_time", time_full)
        .limit(1)
        .execute()
    )
    if existing.data:
        slot = existing.data[0]
        slot_id = slot["id"]
        if slot["is_booked"]:
            # Only block if a live appointment actually references this slot.
            # A slot left flagged booked with no live appointment is an orphan
            # (e.g. from an interrupted cancel) — reuse it instead of dead-ending.
            live = (
                admin.table("appointments")
                .select("id")
                .eq("availability_id", slot_id)
                .neq("status", "cancelled")
                .limit(1)
                .execute()
            )
            if live.data:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="That time is already booked.",
                )
        (
            admin.table("provider_availability")
            .update({"is_booked": True})
            .eq("id", slot_id)
            .execute()
        )
    else:
        created = (
            admin.table("provider_availability")
            .insert(
                {
                    "provider_id": provider_id,
                    "available_date": payload.date,
                    "available_time": time_full,
                    "is_booked": True,
                }
            )
            .execute()
        )
        slot_id = created.data[0]["id"]

    appt = (
        admin.table("appointments")
        .insert(
            {
                "patient_id": payload.patient_id,
                "provider_id": provider_id,
                "availability_id": slot_id,
                "status": "scheduled",
                "notes": payload.notes,
            }
        )
        .execute()
    )
    return appt.data[0]
