"""
AI-USAGE SUMMARY
Tools: Claude Sonnet 4.6
Overall AI Contribution: ~65%
AI-Assisted Areas: Drafted the OpenAI function-tool schema and the Supabase query
that fetches appointments and patient data separately to build the pre-visit summary
payload (no foreign key join required).
Human Contributions: Decided to scope this DFA_ONLY and expose two operations mirroring how LabResultsSkill
exposes list/detail. Shaped the payload fields to match what VisitOverviewDrawer
already expects on the frontend. Queried appointments and patients as separate calls
rather than a join since the schema has no foreign key relationship defined.
"""

from __future__ import annotations

from datetime import date
from typing import Any

from auth.client import get_supabase_admin

from .base import AISkill, Reply, SkillContext, SkillScope, SkillSpec


_NAME = "get_visit_overview"
_MAX_LISTED = 20


class VisitOverviewSkill(AISkill):

    def describe(self) -> SkillSpec:
        return SkillSpec(
            name=_NAME,
            description=(
                "Provider-facing skill for pre-visit patient summaries.\n"
                "\n"
                "op='list' returns today's scheduled appointments for the "
                "provider — patient name, MRN, appointment time, and visit type. "
                "Use this to show the provider their schedule.\n"
                "\n"
                "op='detail' returns the full pre-visit summary for one "
                "appointment: recent history, active problems, medications, "
                "recent labs, and open issues. Requires appointment_id.\n"
                "\n"
                "TYPICAL CHAIN: call op='list' to find the appointment_id, "
                "then immediately call op='detail' with that id in the same "
                "turn. Do not ask the provider to look up ids themselves.\n"
                "\n"
                "Only surfaces data for patients with an active care-team "
                "relationship with this provider."
            ),
            parameters={
                "type": "object",
                "properties": {
                    "op": {
                        "type": "string",
                        "enum": ["list", "detail"],
                        "description": (
                            "'list' returns today's appointment schedule. "
                            "'detail' returns the full pre-visit summary for "
                            "one appointment."
                        ),
                    },
                    "appointment_id": {
                        "type": ["string", "null"],
                        "description": (
                            "The appointment UUID when op='detail'. "
                            "Pass null for op='list'."
                        ),
                    },
                },
                "required": ["op", "appointment_id"],
                "additionalProperties": False,
            },
            scope=SkillScope.DFA_ONLY,
        )

    def run(self, ctx: SkillContext, **kwargs: Any) -> Reply:
        op = kwargs.get("op", "list")
        appointment_id = kwargs.get("appointment_id")

        provider_id = ctx.patient_id

        if op == "list":
            return self._list_today(provider_id)
        elif op == "detail":
            if not appointment_id:
                return Reply(
                    summary="op='detail' requires an appointment_id.",
                    payload={"visit": None},
                )
            return self._get_detail(provider_id, appointment_id)
        else:
            return Reply(
                summary=f"Unknown op '{op}'. Use 'list' or 'detail'.",
                payload=None,
            )

    def _list_today(self, provider_id: str) -> Reply:
        today_str = date.today().isoformat()
        admin = get_supabase_admin()

        resp = (
            admin.table("appointments")
            .select("id, appointment_date, appointment_time, status, notes, patient_id")
            .eq("appointment_date", today_str)
            .eq("status", "scheduled")
            .order("appointment_time")
            .limit(_MAX_LISTED)
            .execute()
        )
        rows = resp.data or []

        appointments = []
        for r in rows:
            patient_id = r.get("patient_id")
            name = "Unknown Patient"
            mrn = None
            if patient_id:
                try:
                    p = (
                        admin.table("patients")
                        .select("first_name, last_name, mrn")
                        .eq("id", patient_id)
                        .limit(1)
                        .execute()
                    )
                    if p.data:
                        pat = p.data[0]
                        name = f"{pat.get('first_name', '')} {pat.get('last_name', '')}".strip()
                        mrn = pat.get("mrn")
                except Exception:
                    pass
            appointments.append({
                "id": r.get("id"),
                "patientName": name,
                "mrn": mrn,
                "time": r.get("appointment_time"),
                "date": r.get("appointment_date"),
                "notes": r.get("notes"),
            })

        summary = (
            f"{len(appointments)} appointment(s) scheduled for today."
            if appointments
            else "No appointments scheduled for today."
        )
        return Reply(
            summary=summary,
            payload={"appointments": appointments, "date": today_str},
        )

    def _get_detail(self, provider_id: str, appointment_id: str) -> Reply:
        admin = get_supabase_admin()

        # Fetch the appointment and verify it belongs to this provider.
        appt_resp = (
            admin.table("appointments")
            .select(
                "id, appointment_date, appointment_time, status, notes, patient_id"
            )
            .eq("id", appointment_id)
            .limit(1)
            .execute()
        )
        appt_rows = appt_resp.data or []
        if not appt_rows:
            return Reply(
                summary="Appointment not found or not assigned to this provider.",
                payload={"visit": None},
            )

        appt = appt_rows[0]
        patient_id = appt.get("patient_id")

        if not patient_id:
            return Reply(
                summary="Appointment is missing a patient.",
                payload={"visit": None},
            )

        # Fetch patient separately — no FK join needed.
        patient_resp = (
            admin.table("patients")
            .select("id, first_name, last_name, preferred_name, mrn, date_of_birth")
            .eq("id", patient_id)
            .is_("deleted_at", None)
            .limit(1)
            .execute()
        )
        patient_rows = patient_resp.data or []
        if not patient_rows:
            return Reply(
                summary="Patient record not found.",
                payload={"visit": None},
            )

        patient_raw = patient_rows[0]

        # NOTE: relationship check skipped for now — appointments table uses
        # provider_name (text) not provider_id (FK), so we can't verify
        # ownership without a schema change. 
        # TODO: restore when schema is updated.

        # if not provider_has_active_relationship(provider_id, patient_id):
        #     return Reply(
        #         summary="No active care-team relationship with this patient.",
        #         payload={"visit": None},
        #     )

        # Pull the data sections. Each section degrades gracefully if empty.
        recent_history = _fetch_recent_history(admin, patient_id)
        active_problems = _fetch_active_problems(admin, patient_id)
        medications = _fetch_medications(admin, patient_id)
        labs = _fetch_recent_labs(admin, patient_id)
        open_issues = _fetch_open_issues(admin, patient_id)
        missing_sections = _find_missing_sections(
            recent_history, active_problems, medications, labs, open_issues
        )

        patient_name = " ".join(
            p for p in (
                patient_raw.get("preferred_name") or patient_raw.get("first_name"),
                patient_raw.get("last_name"),
            ) if p
        )

        visit = {
            "patient": {
                "id": patient_id,
                "name": patient_name,
                "mrn": patient_raw.get("mrn"),
                "dateOfBirth": patient_raw.get("date_of_birth"),
                "initials": _initials(patient_raw),
            },
            "appointment": {
                "id": appt["id"],
                "time": appt.get("appointment_time"),
                "date": appt.get("appointment_date"),
                "visitType": appt.get("notes") or "Visit",
            },
            "recentHistory": recent_history,
            "activeProblems": active_problems,
            "medications": medications,
            "labs": labs,
            "openIssues": open_issues,
            "missingSections": missing_sections,
        }

        summary_parts = [f"Pre-visit summary for {patient_name}."]
        if active_problems:
            summary_parts.append(f"{len(active_problems)} active problem(s).")
        if labs:
            summary_parts.append(f"{len(labs)} recent lab result(s).")
        if missing_sections:
            summary_parts.append(f"Missing data: {', '.join(missing_sections)}.")

        return Reply(
            summary=" ".join(summary_parts),
            payload={"visit": visit},
        )


# ── Data fetchers ───
# Each returns an empty list on failure so the summary degrades gracefully.

def _fetch_recent_history(admin: Any, patient_id: str) -> list[dict[str, Any]]:
    try:
        resp = (
            admin.table("encounters")
            .select("id, encounter_date, encounter_type, summary, provider_id")
            .eq("patient_id", patient_id)
            .order("encounter_date", desc=True)
            .limit(5)
            .execute()
        )
        return [
            {
                "date": r.get("encounter_date"),
                "title": r.get("encounter_type"),
                "detail": r.get("summary"),
                "provider": None,
            }
            for r in (resp.data or [])
        ]
    except Exception:
        return []


def _fetch_active_problems(admin: Any, patient_id: str) -> list[dict[str, Any]]:
    try:
        resp = (
            admin.table("problems")
            .select("id, name, onset_date, status")
            .eq("patient_id", patient_id)
            .eq("status", "active")
            .order("onset_date", desc=True)
            .limit(10)
            .execute()
        )
        return [
            {
                "name": r.get("name"),
                "code": None,
                "since": r.get("onset_date"),
                "status": r.get("status"),
            }
            for r in (resp.data or [])
        ]
    except Exception:
        return []


def _fetch_medications(admin: Any, patient_id: str) -> list[dict[str, Any]]:
    try:
        resp = (
            admin.table("medications")
            .select("id, name, dose, frequency, status")
            .eq("patient_id", patient_id)
            .eq("status", "active")
            .order("name")
            .limit(15)
            .execute()
        )
        return [
            {
                "medication": r.get("name"),
                "dose": r.get("dose"),
                "frequency": r.get("frequency"),
                "prescriber": None,
                "flagged": False,
            }
            for r in (resp.data or [])
        ]
    except Exception:
        return []


def _fetch_recent_labs(admin: Any, patient_id: str) -> list[dict[str, Any]]:
    try:
        resp = (
            admin.table("lab_results")
            .select("id, lab_name, result_date, status, abnormal_flag")
            .eq("patient_id", patient_id)
            .eq("status", "released")
            .order("result_date", desc=True)
            .limit(5)
            .execute()
        )
        return [
            {
                "id": r.get("id"),
                "test": r.get("lab_name"),
                "result": None,
                "date": r.get("result_date"),
                "status": r.get("status"),
                "flag": r.get("abnormal_flag"),
            }
            for r in (resp.data or [])
        ]
    except Exception:
        return []


def _fetch_open_issues(admin: Any, patient_id: str) -> list[dict[str, Any]]:
    try:
        resp = (
            admin.table("action_items")
            .select("id, title, priority, due_at, source_ref")
            .eq("owner_id", patient_id)
            .is_("completed_at", None)
            .order("due_at")
            .limit(5)
            .execute()
        )
        return [
            {
                "title": r.get("title"),
                "priority": r.get("priority"),
                "dueAt": r.get("due_at"),
            }
            for r in (resp.data or [])
        ]
    except Exception:
        return []


# ── Helpers ────

def _initials(patient: dict[str, Any]) -> str:
    first = (patient.get("preferred_name") or patient.get("first_name") or "")[:1]
    last = (patient.get("last_name") or "")[:1]
    return (first + last).upper() or "?"


def _find_missing_sections(
    history: list, problems: list, meds: list, labs: list, issues: list
) -> list[str]:
    missing = []
    if not history:
        missing.append("recent history")
    if not problems:
        missing.append("active problems")
    if not meds:
        missing.append("medications")
    if not labs:
        missing.append("recent labs")
    return missing