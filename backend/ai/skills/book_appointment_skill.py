"""
AI-USAGE SUMMARY
Tools: Claude (Opus 4.8)
Overall AI Contribution: ~75%
AI-Assisted Areas: Drafted the OpenAI function-tool schema and the stage-resolution logic (confirm / alternatives / choose_time / choose_provider / none) plus the provider-name matching and slot-view projections.
Human Contributions: Decided the skill is read-only — it proposes bookable options and the patient confirms through the in-chat card which calls the proven POST /appointments/ endpoint, so the LLM never performs the write. Shaped each stage payload so BookAppointmentCard can render and book without another model round-trip, and required that every option carry both provider_id and availability_id so the deterministic booking call needs nothing the card has to re-fetch.
"""

from __future__ import annotations

import re
from datetime import date, datetime
from typing import Any

from appointments import service as appointments_service
from providers import service as providers_service

from .base import AISkill, Reply, SkillContext, SkillScope, SkillSpec

_NAME = "book_appointment"
_MAX_OPTIONS = 8


class BookAppointmentSkill(AISkill):
    """Propose bookable appointment options for the patient to confirm in-chat.

    This skill is intentionally read-only. It resolves the patient's requested
    provider / date / time against open availability and returns one of a small
    set of UI "stages". The actual write happens when the patient confirms in
    the BookAppointmentCard, which calls the existing POST /appointments/
    endpoint — so booking stays deterministic and the LLM never books blindly.
    """

    def describe(self) -> SkillSpec:
        return SkillSpec(
            name=_NAME,
            description=(
                "Start booking a NEW appointment for the signed-in patient. Use this "
                "whenever the patient wants to schedule, book, or set up an appointment "
                "(e.g. 'book me with Dr. Smith at 9am tomorrow', 'I need to see a "
                "cardiologist'). Extract whatever the patient gave you: the provider's "
                "name, a specialty, a date (YYYY-MM-DD), and a time (24-hour HH:MM). "
                "Resolve relative dates like 'tomorrow' against today's date before "
                "calling. This tool does NOT book the appointment — it returns options "
                "and the patient confirms in an interactive card. Do not re-list the "
                "providers, times, or confirmation details in your prose; the card "
                "shows them. Keep your reply to a short sentence."
            ),
            parameters={
                "type": "object",
                "properties": {
                    "provider_name": {
                        "type": ["string", "null"],
                        "description": (
                            "The provider's name as the patient said it (full or "
                            "partial, e.g. 'Smith' or 'Dr. Jane Smith'). Null if the "
                            "patient did not name a provider."
                        ),
                    },
                    "specialty": {
                        "type": ["string", "null"],
                        "description": (
                            "A specialty the patient asked for (e.g. 'cardiology'). "
                            "Null if none was mentioned."
                        ),
                    },
                    "date": {
                        "type": ["string", "null"],
                        "description": (
                            "Requested date as ISO YYYY-MM-DD, already resolved from "
                            "any relative phrasing. Null if not specified."
                        ),
                    },
                    "time": {
                        "type": ["string", "null"],
                        "description": (
                            "Requested time as 24-hour HH:MM (e.g. '09:00'). Null if "
                            "not specified."
                        ),
                    },
                    "notes": {
                        "type": ["string", "null"],
                        "description": (
                            "Optional reason for the visit the patient mentioned. "
                            "Null if none."
                        ),
                    },
                },
                "required": ["provider_name", "specialty", "date", "time", "notes"],
                "additionalProperties": False,
            },
            scope=SkillScope.PFA_ONLY,
        )

    def run(self, ctx: SkillContext, **kwargs: Any) -> Reply:
        provider_name = _clean_str(kwargs.get("provider_name"))
        specialty = _clean_str(kwargs.get("specialty"))
        req_date = _normalize_date(kwargs.get("date"))
        req_time = _normalize_time(kwargs.get("time"))
        notes = _clean_str(kwargs.get("notes"))

        avail = appointments_service.get_availability()
        slots_by_provider: dict[str, list[dict[str, Any]]] = {}
        for s in avail:
            slots_by_provider.setdefault(s.get("provider_id"), []).append(s)

        if not avail:
            return _reply_none(
                "There are no open appointment slots available right now.", notes
            )

        providers = providers_service.get_providers()
        matched = _match_providers(providers, provider_name, specialty)

        # Patient named a provider we can't find at all.
        if provider_name and not matched:
            return _choose_provider(
                avail,
                req_date,
                req_time,
                notes,
                note=f"I couldn't find a provider matching “{provider_name}”.",
            )

        # No provider narrowed down — let the patient pick one.
        if not matched:
            return _choose_provider(avail, req_date, req_time, notes)

        # Specialty / ambiguous name matched several providers — disambiguate.
        if len(matched) > 1:
            ids = {p.get("id") for p in matched}
            scoped = [s for s in avail if s.get("provider_id") in ids]
            if not scoped:
                return _choose_provider(
                    avail,
                    req_date,
                    req_time,
                    notes,
                    note="None of the matching providers have open slots; "
                    "here are other available providers.",
                )
            return _choose_provider(scoped, req_date, req_time, notes)

        # Exactly one provider resolved.
        prov = matched[0]
        pslots = sorted(slots_by_provider.get(prov.get("id"), []), key=_slot_sort)

        if not pslots:
            return _choose_provider(
                avail,
                req_date,
                req_time,
                notes,
                note=f"{_provider_label(prov)} has no open slots right now; "
                "here are other available providers.",
            )

        if req_date and req_time:
            exact = [
                s
                for s in pslots
                if s.get("available_date") == req_date
                and s.get("available_time") == req_time
            ]
            if exact:
                return _reply_confirm(exact[0], notes)
            return _reply_alternatives(
                avail, prov, pslots, req_date, req_time, notes
            )

        # Provider known but no exact date+time — show their open times,
        # filtered to whichever of date/time the patient did give.
        filtered = [
            s
            for s in pslots
            if (not req_date or s.get("available_date") == req_date)
            and (not req_time or s.get("available_time") == req_time)
        ]
        return _reply_choose_time(prov, filtered or pslots, notes)


# ── Reply builders ───────────────────────────────────────────


def _reply_confirm(slot: dict[str, Any], notes: str | None) -> Reply:
    option = _option_from_slot(slot)
    prov = option["provider"]
    when = _human_when(option["slot"])
    return Reply(
        summary=(
            f"{prov['name']} is open {when}. Confirm in the card to book."
        ),
        payload={
            "stage": "confirm",
            "provider": prov,
            "slot": option["slot"],
            "notes": notes,
        },
    )


def _reply_alternatives(
    avail: list[dict[str, Any]],
    prov: dict[str, Any],
    pslots: list[dict[str, Any]],
    req_date: str,
    req_time: str,
    notes: str | None,
) -> Reply:
    other = _other_providers_at(avail, req_date, req_time, exclude=prov.get("id"))
    provider_view = _provider_view(prov)
    when = _human_when({"date": req_date, "time": req_time})

    if not pslots and not other:
        return _reply_none(
            f"{provider_view['name']} isn't available {when}, and no other "
            "providers are open then either.",
            notes,
        )

    return Reply(
        summary=(
            f"{provider_view['name']} isn't available {when}. You can pick a "
            "different time with them or another provider at that time — choose "
            "in the card."
        ),
        payload={
            "stage": "alternatives",
            "provider": provider_view,
            "requested": {"date": req_date, "time": req_time},
            "provider_slots": [_slot_view(s) for s in pslots[:_MAX_OPTIONS]],
            "other_providers": other[:_MAX_OPTIONS],
            "notes": notes,
        },
    )


def _reply_choose_time(
    prov: dict[str, Any], slots: list[dict[str, Any]], notes: str | None
) -> Reply:
    provider_view = _provider_view(prov)
    return Reply(
        summary=(
            f"Here are {provider_view['name']}'s open times — pick one in the card."
        ),
        payload={
            "stage": "choose_time",
            "provider": provider_view,
            "slots": [_slot_view(s) for s in slots[:_MAX_OPTIONS]],
            "notes": notes,
        },
    )


def _choose_provider(
    avail: list[dict[str, Any]],
    req_date: str | None,
    req_time: str | None,
    notes: str | None,
    note: str | None = None,
) -> Reply:
    """Offer one bookable option per provider.

    If a date+time was requested, prefer the slot at exactly that time; if no
    provider is open then, fall back to each provider's soonest slot.
    """
    options: list[dict[str, Any]] = []
    if req_date and req_time:
        at_time = [
            s
            for s in avail
            if s.get("available_date") == req_date
            and s.get("available_time") == req_time
        ]
        options = _one_option_per_provider(at_time)

    fallback = False
    if not options:
        fallback = bool(req_date and req_time)
        options = _one_option_per_provider(sorted(avail, key=_slot_sort))

    if not options:
        return _reply_none("There are no open appointment slots available right now.", notes)

    if note:
        summary = note + " Pick one in the card."
    elif fallback:
        when = _human_when({"date": req_date, "time": req_time})
        summary = (
            f"No providers are open {when}. Here are the soonest available "
            "options — pick one in the card."
        )
    else:
        summary = "Here are providers you can book with — pick one in the card."

    return Reply(
        summary=summary,
        payload={
            "stage": "choose_provider",
            "options": options[:_MAX_OPTIONS],
            "requested": {"date": req_date, "time": req_time},
            "notes": notes,
        },
    )


def _reply_none(summary: str, notes: str | None) -> Reply:
    return Reply(
        summary=summary,
        payload={"stage": "none", "notes": notes},
    )


# ── Views / projections ──────────────────────────────────────


def _provider_view(p: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": p.get("id"),
        "name": _provider_label(p),
        "specialty": p.get("specialty"),
    }


def _slot_provider_view(slot: dict[str, Any]) -> dict[str, Any]:
    p = slot.get("providers") or {}
    return {
        "id": slot.get("provider_id"),
        "name": _provider_label(p),
        "specialty": p.get("specialty"),
    }


def _slot_view(slot: dict[str, Any]) -> dict[str, Any]:
    return {
        "availability_id": slot.get("id"),
        "date": slot.get("available_date"),
        "time": slot.get("available_time"),
    }


def _option_from_slot(slot: dict[str, Any]) -> dict[str, Any]:
    return {"provider": _slot_provider_view(slot), "slot": _slot_view(slot)}


def _provider_label(p: dict[str, Any]) -> str:
    return " ".join(
        x for x in [p.get("title"), p.get("first_name"), p.get("last_name")] if x
    ).strip()


def _one_option_per_provider(slots: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Pick the soonest slot for each distinct provider, in slot order."""
    seen: set[str] = set()
    options: list[dict[str, Any]] = []
    for s in sorted(slots, key=_slot_sort):
        pid = s.get("provider_id")
        if pid in seen:
            continue
        seen.add(pid)
        options.append(_option_from_slot(s))
    return options


def _other_providers_at(
    avail: list[dict[str, Any]], req_date: str, req_time: str, exclude: str | None
) -> list[dict[str, Any]]:
    at_time = [
        s
        for s in avail
        if s.get("available_date") == req_date
        and s.get("available_time") == req_time
        and s.get("provider_id") != exclude
    ]
    return _one_option_per_provider(at_time)


# ── Matching / parsing helpers ───────────────────────────────


def _match_providers(
    providers: list[dict[str, Any]],
    provider_name: str | None,
    specialty: str | None,
) -> list[dict[str, Any]]:
    """Resolve a provider query to candidate providers.

    Name match is a case-insensitive two-way substring test against several
    name renderings. When no name is given but a specialty is, match on
    specialty. When neither is given, return [].
    """
    if provider_name:
        q = provider_name.lower().strip()
        # Strip a leading honorific so "Dr. Smith" matches "Smith".
        q = re.sub(r"^(dr|doctor|prof|professor)\.?\s+", "", q)
        out = []
        for p in providers:
            first = (p.get("first_name") or "").lower()
            last = (p.get("last_name") or "").lower()
            candidates = [
                f"{first} {last}".strip(),
                last,
                first,
            ]
            if any(c and (q in c or c in q) for c in candidates):
                out.append(p)
        return out

    if specialty:
        q = specialty.lower().strip()
        return [
            p
            for p in providers
            if (p.get("specialty") or "").lower().find(q) != -1
        ]

    return []


def _clean_str(v: Any) -> str | None:
    if not isinstance(v, str):
        return None
    v = v.strip()
    return v or None


def _normalize_date(v: Any) -> str | None:
    """Coerce a date value to ISO YYYY-MM-DD, or None if unparseable."""
    s = _clean_str(v)
    if not s:
        return None
    try:
        return datetime.fromisoformat(s).date().isoformat()
    except (TypeError, ValueError):
        return None


def _normalize_time(v: Any) -> str | None:
    """Coerce common time renderings to 24-hour HH:MM, or None.

    Accepts '9', '9:00', '09:00', '9am', '9:30 PM', '14:00', '14:00:00'.
    """
    s = _clean_str(v)
    if not s:
        return None
    s = s.lower().replace(" ", "")
    m = re.match(r"^(\d{1,2})(?::(\d{2}))?(?::\d{2})?(am|pm)?$", s)
    if not m:
        return None
    hour = int(m.group(1))
    minute = int(m.group(2) or 0)
    meridiem = m.group(3)
    if meridiem == "am":
        if hour == 12:
            hour = 0
    elif meridiem == "pm":
        if hour != 12:
            hour += 12
    if not (0 <= hour <= 23 and 0 <= minute <= 59):
        return None
    return f"{hour:02d}:{minute:02d}"


def _slot_sort(s: dict[str, Any]) -> tuple[str, str]:
    return (s.get("available_date") or "", s.get("available_time") or "")


_MONTHS = (
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
)


def _human_when(slot: dict[str, Any]) -> str:
    """Render a slot {date,time} as e.g. 'on Jun 20 at 9:00 AM'."""
    d = slot.get("date")
    t = slot.get("time")
    parts: list[str] = []
    if d:
        try:
            dt = date.fromisoformat(d)
            parts.append(f"on {_MONTHS[dt.month - 1]} {dt.day}")
        except (TypeError, ValueError):
            parts.append(f"on {d}")
    if t:
        parts.append(f"at {_human_time(t)}")
    return " ".join(parts) if parts else "then"


def _human_time(t: str) -> str:
    try:
        hh, mm = t.split(":")[:2]
        h = int(hh)
    except (TypeError, ValueError):
        return t
    ampm = "PM" if h >= 12 else "AM"
    h12 = h % 12 or 12
    return f"{h12}:{mm} {ampm}"
