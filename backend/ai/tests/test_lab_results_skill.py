"""
AI-USAGE SUMMARY
Tools: Claude (Opus 4.8)
Overall AI Contribution: ~85%
AI-Assisted Areas: Drafted the pytest cases for ai.skills.lab_results_skill — the list/detail dispatch, the limit clamp, the detail projection (entries + flagged_count), and the failure paths.
Human Contributions: Decided to mock lab_results.service.list_for_patient / get_for_patient (they already decrypt + enforce status='released'), pinned the [1, 25] clamp behavior, and verified that the detail projection defaults a missing abnormal_flag to "normal" so the card never renders an empty pill.
"""

from __future__ import annotations

import pytest

from ai.skills.base import SkillContext, SkillScope
from ai.skills.lab_results_skill import LabResultsSkill


@pytest.fixture
def ctx():
    return SkillContext(patient_id="patient-1", user_id="user-1")


@pytest.fixture
def skill():
    return LabResultsSkill()


class TestDescribe:
    def test_is_patient_facing_only(self):
        spec = LabResultsSkill().describe()
        assert spec.scope is SkillScope.PFA_ONLY
        assert spec.name == "get_lab_results"


class TestListOp:
    def test_list_projects_headers_only(self, skill, ctx, monkeypatch):
        rows = [
            {
                "id": "lab-1",
                "lab_name": "CBC",
                "status": "released",
                "collected_at": "2026-05-01",
                "resulted_at": "2026-05-02",
                "released_at": "2026-05-03",
                "secret_encrypted": "xxx",
            }
        ]
        monkeypatch.setattr(
            "ai.skills.lab_results_skill.lab_service.list_for_patient",
            lambda **kwargs: rows,
        )
        reply = skill.run(ctx, op="list", lab_result_id=None, limit=None)
        assert reply.payload["op"] == "list"
        result = reply.payload["results"][0]
        assert result["lab_name"] == "CBC"
        assert "secret_encrypted" not in result
        assert "CBC" in reply.summary

    def test_list_clamps_limit_to_25(self, skill, ctx, monkeypatch):
        captured = {}

        def fake_list(**kwargs):
            captured.update(kwargs)
            return []

        monkeypatch.setattr(
            "ai.skills.lab_results_skill.lab_service.list_for_patient", fake_list
        )
        skill.run(ctx, op="list", lab_result_id=None, limit=999)
        assert captured["limit"] == 25

    def test_list_default_limit_is_ten(self, skill, ctx, monkeypatch):
        captured = {}

        def fake_list(**kwargs):
            captured.update(kwargs)
            return []

        monkeypatch.setattr(
            "ai.skills.lab_results_skill.lab_service.list_for_patient", fake_list
        )
        skill.run(ctx, op="list", lab_result_id=None, limit=None)
        assert captured["limit"] == 10

    def test_empty_list_summary(self, skill, ctx, monkeypatch):
        monkeypatch.setattr(
            "ai.skills.lab_results_skill.lab_service.list_for_patient",
            lambda **kwargs: [],
        )
        reply = skill.run(ctx, op="list", lab_result_id=None, limit=None)
        assert reply.summary == "No released lab results yet."


class TestDetailOp:
    def test_detail_requires_an_id(self, skill, ctx):
        reply = skill.run(ctx, op="detail", lab_result_id=None, limit=None)
        assert reply.payload["results"] == []
        assert "requires `lab_result_id`" in reply.summary

    def test_detail_projects_entries_and_flag_count(self, skill, ctx, monkeypatch):
        row = {
            "id": "lab-1",
            "lab_name": "Lipid Panel",
            "ordering_provider_name": "Dr. A",
            "collected_at": "2026-05-01",
            "resulted_at": "2026-05-02",
            "released_at": "2026-05-03",
            "notes": "fasting",
            "entries": [
                {"id": "e1", "component_name": "LDL", "value": "160", "unit": "mg/dL",
                 "reference_range": "<100", "abnormal_flag": "high"},
                {"id": "e2", "component_name": "HDL", "value": "55", "unit": "mg/dL",
                 "reference_range": ">40", "abnormal_flag": None},
            ],
        }
        monkeypatch.setattr(
            "ai.skills.lab_results_skill.lab_service.get_for_patient",
            lambda **kwargs: row,
        )
        reply = skill.run(ctx, op="detail", lab_result_id="lab-1", limit=None)
        detail = reply.payload["results"][0]
        assert detail["flagged_count"] == 1
        # A null abnormal_flag is normalized to "normal".
        flags = {e["component_name"]: e["abnormal_flag"] for e in detail["entries"]}
        assert flags["HDL"] == "normal"
        assert "1 flagged value(s)" in reply.summary

    def test_detail_handles_service_error(self, skill, ctx, monkeypatch):
        def boom(**kwargs):
            raise RuntimeError("not allowed")

        monkeypatch.setattr(
            "ai.skills.lab_results_skill.lab_service.get_for_patient", boom
        )
        reply = skill.run(ctx, op="detail", lab_result_id="lab-x", limit=None)
        assert reply.payload["results"] == []
        assert "not available" in reply.summary
