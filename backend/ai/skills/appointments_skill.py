"""
AI-USAGE SUMMARY
Tools: Opus 4.7
Overall AI Contribution: ~70%
AI-Assisted Areas: Drafted the OpenAI function-tool schema and the filter-branching logic (upcoming / past / next / on_date).
Human Contributions: Decided to wrap appointments.service.get_appointments verbatim (no duplicated Supabase queries), shaped the structured payload so the AppointmentsCard component can render without further fetches, and capped the result count at 10 for context-window control.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from appointments import service as appointments_service

from .base import AISkill, Reply, SkillContext, SkillScope, SkillSpec


_NAME = "get_appointments"
_MAX_RETURNED = 10


class AppointmentsSkill(AISkill):
    def describe(self) -> SkillSpec:
        return SkillSpec(
            name=_NAME,
            description=(
                "Look up the signed-in patient's own appointments. "
                "Use this whenever the patient asks about their schedule, next visit, "
                "upcoming appointments, or past visits. Always returns appointments "
                "scoped to the authenticated patient, never another patient."
            ),
            parameters={
                "type": "object",
                "properties": {
                    "filter": {
                        "type": "string",
                        "enum": ["upcoming", "next", "past", "on_date", "all"],
                        "description": (
                            "Which slice of the patient's appointments to return. "
                            "'next' returns at most one (the soonest upcoming). "
                            "'on_date' requires the `date` argument."
                        ),
                    },
                    "date": {
                        "type": ["string", "null"],
                        "description": (
                            "ISO date (YYYY-MM-DD) when filter='on_date'. "
                            "Pass null for any other filter value."
                        ),
                    },
                },
                "required": ["filter", "date"],
                "additionalProperties": False,
            },
            scope=SkillScope.PFA_ONLY,
        )

    def run(self, ctx: SkillContext, **kwargs: Any) -> Reply:
        filt = kwargs.get("filter", "upcoming")
        on_date = kwargs.get("date")

        all_appts = appointments_service.get_appointments(ctx.patient_id)
        today = date.today()

        def is_upcoming(a: dict[str, Any]) -> bool:
            d = _parse_date(a.get("appointment_date"))
            return d is not None and d >= today and a.get("status") == "scheduled"

        def is_past(a: dict[str, Any]) -> bool:
            d = _parse_date(a.get("appointment_date"))
            return d is not None and d < today

        if filt == "upcoming":
            picked = sorted(
                [a for a in all_appts if is_upcoming(a)],
                key=_sort_key,
            )[:_MAX_RETURNED]
        elif filt == "next":
            upcoming = sorted([a for a in all_appts if is_upcoming(a)], key=_sort_key)
            picked = upcoming[:1]
        elif filt == "past":
            picked = sorted(
                [a for a in all_appts if is_past(a)],
                key=_sort_key,
                reverse=True,
            )[:_MAX_RETURNED]
        elif filt == "on_date":
            if not on_date:
                return Reply(
                    summary="filter='on_date' requires a `date` argument (YYYY-MM-DD).",
                    payload={"appointments": [], "filter": filt},
                )
            picked = [a for a in all_appts if a.get("appointment_date") == on_date]
        else:  # "all"
            picked = sorted(all_appts, key=_sort_key)[:_MAX_RETURNED]

        rows = [_to_card_row(a) for a in picked]
        summary = _summarize(filt, rows)

        return Reply(
            summary=summary,
            payload={"appointments": rows, "filter": filt},
        )


def _parse_date(s: str | None) -> date | None:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s).date()
    except (TypeError, ValueError):
        return None


def _sort_key(a: dict[str, Any]) -> tuple[str, str]:
    return (a.get("appointment_date") or "", a.get("appointment_time") or "")


def _to_card_row(a: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": a.get("id"),
        "provider_name": a.get("provider_name"),
        "specialty": a.get("specialty"),
        "location": a.get("location"),
        "appointment_date": a.get("appointment_date"),
        "appointment_time": a.get("appointment_time"),
        "status": a.get("status"),
        "notes": a.get("notes"),
    }


def _summarize(filt: str, rows: list[dict[str, Any]]) -> str:
    if not rows:
        if filt == "next":
            return "The patient has no upcoming scheduled appointments."
        if filt == "past":
            return "No past appointments found for the patient."
        if filt == "on_date":
            return "No appointments on that date."
        return "No appointments found."

    if filt == "next":
        a = rows[0]
        return (
            f"Next appointment: {a['provider_name']}"
            + (f" ({a['specialty']})" if a.get("specialty") else "")
            + f" on {a['appointment_date']} at {a['appointment_time']}"
            + (f" — {a['location']}." if a.get("location") else ".")
        )
    return f"Returned {len(rows)} {filt} appointment(s)."
