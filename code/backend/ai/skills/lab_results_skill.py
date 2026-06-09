"""
AI-USAGE SUMMARY
Tools: Opus 4.7
Overall AI Contribution: ~70%
AI-Assisted Areas: Drafted the OpenAI function-tool schema and the projection that strips encrypted/internal fields before the model sees them.
Human Contributions: Decided to expose exactly two operations (list released results, get one result detail), reused lab_results.service.list_for_patient / get_for_patient verbatim (they already decrypt values for the patient and enforce status='released'), and shaped the structured payload so LabResultsCard can render trends/flags without re-fetching.
"""

from __future__ import annotations

from typing import Any

from lab_results import service as lab_service

from .base import AISkill, Reply, SkillContext, SkillScope, SkillSpec


_NAME = "get_lab_results"
_DETAIL_NAME = "get_lab_result_detail"
_MAX_LISTED = 10


class LabResultsSkill(AISkill):

    def describe(self) -> SkillSpec:
        return SkillSpec(
            name=_NAME,
            description=(
                "Look up the signed-in patient's own released lab results.\n"
                "\n"
                "op='list' returns ONLY headers (lab_name, dates, status). It "
                "does NOT include test values, units, reference ranges, or "
                "abnormal flags.\n"
                "\n"
                "op='detail' returns the actual analyte rows (component_name, "
                "value, unit, reference_range, abnormal_flag) for one lab. "
                "Required for any question about specific results, whether "
                "values are high/low/normal, what's worth worrying about, "
                "plain-language explanations of components, etc.\n"
                "\n"
                "TYPICAL CHAIN: call op='list' first to find the id of the lab "
                "the user is asking about, then IMMEDIATELY call op='detail' "
                "with that lab_result_id in the same turn. Don't stop after "
                "the list and don't ask the user to paste values — fetch them "
                "yourself with op='detail'.\n"
                "\n"
                "Only results released by the care team are visible to this "
                "patient."
            ),
            parameters={
                "type": "object",
                "properties": {
                    "op": {
                        "type": "string",
                        "enum": ["list", "detail"],
                        "description": "'list' for recent labs; 'detail' for one result by id.",
                    },
                    "lab_result_id": {
                        "type": ["string", "null"],
                        "description": (
                            "Required when op='detail'. Pass null when op='list'."
                        ),
                    },
                    "limit": {
                        "type": ["integer", "null"],
                        "description": (
                            "Max results when op='list'. Server clamps to [1, 25]. "
                            "Pass null to use the default of 10."
                        ),
                    },
                },
                "required": ["op", "lab_result_id", "limit"],
                "additionalProperties": False,
            },
            scope=SkillScope.PFA_ONLY,
        )

    def run(self, ctx: SkillContext, **kwargs: Any) -> Reply:
        op = kwargs.get("op", "list")
        if op == "detail":
            lab_id = kwargs.get("lab_result_id")
            if not lab_id:
                return Reply(
                    summary="op='detail' requires `lab_result_id`.",
                    payload={"results": [], "op": op},
                )
            return self._detail(ctx, lab_id)
        raw_limit = kwargs.get("limit")
        limit = int(raw_limit) if raw_limit else _MAX_LISTED
        limit = max(1, min(25, limit))
        return self._list(ctx, limit)

    def _list(self, ctx: SkillContext, limit: int) -> Reply:
        rows = lab_service.list_for_patient(
            patient_id=ctx.patient_id, limit=limit, offset=0
        )
        listed = [_to_list_row(r) for r in rows]
        return Reply(
            summary=_summarize_list(listed),
            payload={"op": "list", "results": listed},
        )

    def _detail(self, ctx: SkillContext, lab_result_id: str) -> Reply:
        try:
            row = lab_service.get_for_patient(
                patient_id=ctx.patient_id, lab_result_id=lab_result_id
            )
        except Exception:
            return Reply(
                summary="That lab result is not available to you.",
                payload={"op": "detail", "results": [], "lab_result_id": lab_result_id},
            )

        detail = _to_detail_row(row)
        return Reply(
            summary=_summarize_detail(detail),
            payload={"op": "detail", "results": [detail], "lab_result_id": lab_result_id},
        )


def _to_list_row(r: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": r.get("id"),
        "lab_name": r.get("lab_name"),
        "status": r.get("status"),
        "collected_at": r.get("collected_at"),
        "resulted_at": r.get("resulted_at"),
        "released_at": r.get("released_at"),
    }


def _to_detail_row(r: dict[str, Any]) -> dict[str, Any]:
    entries = [
        {
            "id": e.get("id"),
            "component_name": e.get("component_name"),
            "loinc_code": e.get("loinc_code"),
            "value": e.get("value"),
            "value_numeric": e.get("value_numeric"),
            "unit": e.get("unit"),
            "reference_range": e.get("reference_range"),
            "abnormal_flag": e.get("abnormal_flag") or "normal",
        }
        for e in r.get("entries") or []
    ]
    flagged = [e for e in entries if (e["abnormal_flag"] or "normal") != "normal"]
    return {
        "id": r.get("id"),
        "lab_name": r.get("lab_name"),
        "ordering_provider_name": r.get("ordering_provider_name"),
        "collected_at": r.get("collected_at"),
        "resulted_at": r.get("resulted_at"),
        "released_at": r.get("released_at"),
        "notes": r.get("notes"),
        "entries": entries,
        "flagged_count": len(flagged),
    }


def _summarize_list(rows: list[dict[str, Any]]) -> str:
    if not rows:
        return "No released lab results yet."
    names = ", ".join(r.get("lab_name") or "Lab" for r in rows[:5])
    suffix = "" if len(rows) <= 5 else f" (+{len(rows) - 5} more)"
    return f"Found {len(rows)} released lab result(s): {names}{suffix}."


def _summarize_detail(d: dict[str, Any]) -> str:
    flagged = d.get("flagged_count", 0)
    extra = f" — {flagged} flagged value(s)" if flagged else ""
    return (
        f"{d.get('lab_name') or 'Lab result'} with {len(d.get('entries') or [])} "
        f"component(s){extra}."
    )
