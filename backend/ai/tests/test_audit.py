"""
AI-USAGE SUMMARY
Tools: Claude (Opus 4.8)
Overall AI Contribution: ~85%
AI-Assisted Areas: Drafted the pytest cases for ai.audit — the AuditKind taxonomy, the row builder, and the best-effort write semantics.
Human Contributions: Locked down the rule that an audit write must never raise into the request path (SCRUM-49), and that the required event kinds (TENANCY_VIOLATION_BLOCKED etc.) exist; mocked the admin Supabase client so no network call happens.
"""

from __future__ import annotations

from ai.audit import AuditKind, log


class _FakeTable:
    def __init__(self, sink):
        self._sink = sink

    def insert(self, row):
        self._sink["row"] = row
        return self

    def execute(self):
        self._sink["executed"] = True
        return None


class _FakeAdmin:
    def __init__(self, sink):
        self._sink = sink

    def table(self, name):
        self._sink["table"] = name
        return _FakeTable(self._sink)


class TestAuditKind:
    def test_required_kinds_exist(self):
        names = {k.name for k in AuditKind}
        assert {
            "TENANCY_VIOLATION_BLOCKED",
            "MESSAGE_SENT",
            "RETRIEVAL_PERFORMED",
            "SKILL_DISPATCHED",
            "ASSISTANT_REPLIED",
        }.issubset(names)

    def test_value_matches_name(self):
        assert AuditKind.MESSAGE_SENT.value == "MESSAGE_SENT"


class TestLog:
    def test_writes_row_to_audit_table(self, monkeypatch):
        sink = {}
        monkeypatch.setattr(
            "ai.audit.get_supabase_admin", lambda: _FakeAdmin(sink)
        )
        log(
            AuditKind.MESSAGE_SENT,
            patient_id="p1",
            actor_user_id="u1",
            conversation_id="c1",
            payload={"length": 3},
        )
        assert sink["table"] == "ai_audit_events"
        assert sink["row"]["event_kind"] == "MESSAGE_SENT"
        assert sink["row"]["patient_id"] == "p1"
        assert sink["row"]["payload"] == {"length": 3}

    def test_defaults_payload_to_empty_dict(self, monkeypatch):
        sink = {}
        monkeypatch.setattr(
            "ai.audit.get_supabase_admin", lambda: _FakeAdmin(sink)
        )
        log(AuditKind.CONVERSATION_STARTED, patient_id="p1")
        assert sink["row"]["payload"] == {}

    def test_write_failure_is_swallowed(self, monkeypatch):
        def boom():
            raise RuntimeError("db down")

        monkeypatch.setattr("ai.audit.get_supabase_admin", boom)
        # Must not raise into the request path.
        log(AuditKind.MESSAGE_SENT, patient_id="p1")
