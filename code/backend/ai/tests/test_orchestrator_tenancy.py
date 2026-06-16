"""
AI-USAGE SUMMARY
Tools: Claude (Opus 4.8)
Overall AI Contribution: ~85%
AI-Assisted Areas: Drafted the pytest cases for ai.retrieval.orchestrator — the Python-side tenancy re-validation, the TENANCY_VIOLATION_BLOCKED audit emission, and the graceful-degradation paths (empty query, embedding failure).
Human Contributions: This is the SCRUM-49 / AT2 guarantee, so I locked down the security-critical behavior: any row whose patient_id != the authed patient must be dropped AND must abort the whole retrieval (returning []), and the violation must be audited. Mocked embed_one + _vector_search so the test exercises the enforcement logic without a live pgvector backend.
"""

from __future__ import annotations

import pytest

from ai.retrieval.orchestrator import RetrievalOrchestrator, RetrievedChunk


@pytest.fixture
def patched(monkeypatch):
    """Capture audit events and stub the embedding call for every test."""
    events = []
    monkeypatch.setattr(
        "ai.retrieval.orchestrator.audit_log",
        lambda kind, **kwargs: events.append((kind, kwargs)),
    )
    monkeypatch.setattr(
        "ai.retrieval.orchestrator.embed_one", lambda text: [0.1, 0.2, 0.3]
    )
    return events


def _stub_vector_search(orch, rows):
    orch._vector_search = lambda **kwargs: rows  # type: ignore[assignment]


class TestConstruction:
    def test_requires_patient_id(self):
        with pytest.raises(ValueError):
            RetrievalOrchestrator(patient_id="")


class TestRetrieve:
    def test_blank_query_returns_empty(self, patched):
        orch = RetrievalOrchestrator(patient_id="patient-1")
        assert orch.retrieve("   ") == []

    def test_embedding_failure_degrades_to_empty(self, monkeypatch):
        monkeypatch.setattr(
            "ai.retrieval.orchestrator.audit_log", lambda *a, **k: None
        )

        def boom(text):
            raise RuntimeError("openai down")

        monkeypatch.setattr("ai.retrieval.orchestrator.embed_one", boom)
        orch = RetrievalOrchestrator(patient_id="patient-1")
        assert orch.retrieve("anything") == []

    def test_matching_rows_become_chunks(self, patched):
        orch = RetrievalOrchestrator(patient_id="patient-1")
        _stub_vector_search(
            orch,
            [
                {
                    "id": "c1",
                    "document_id": "d1",
                    "patient_id": "patient-1",
                    "source": "records",
                    "content": "Appointment with Dr. Smith",
                    "score": 0.1,
                }
            ],
        )
        chunks = orch.retrieve("appointments")
        assert len(chunks) == 1
        assert isinstance(chunks[0], RetrievedChunk)
        assert chunks[0].chunk_id == "c1"
        kinds = [str(k.value) for k, _ in patched]
        assert "RETRIEVAL_PERFORMED" in kinds

    def test_foreign_patient_row_aborts_and_audits(self, patched):
        orch = RetrievalOrchestrator(patient_id="patient-1", actor_user_id="user-1")
        _stub_vector_search(
            orch,
            [
                {
                    "id": "leak",
                    "document_id": "d9",
                    "patient_id": "patient-2",  # belongs to someone else
                    "source": "records",
                    "content": "Another patient's record",
                },
            ],
        )
        result = orch.retrieve("labs")
        # Hard fail: nothing leaks through.
        assert result == []
        kinds = [str(k.value) for k, _ in patched]
        assert "TENANCY_VIOLATION_BLOCKED" in kinds
        assert "RETRIEVAL_PERFORMED" not in kinds

    def test_mixed_rows_still_abort_completely(self, patched):
        orch = RetrievalOrchestrator(patient_id="patient-1")
        _stub_vector_search(
            orch,
            [
                {"id": "ok", "document_id": "d1", "patient_id": "patient-1",
                 "source": "records", "content": "mine"},
                {"id": "leak", "document_id": "d2", "patient_id": "patient-2",
                 "source": "records", "content": "theirs"},
            ],
        )
        assert orch.retrieve("labs") == []


class TestRetrievedChunk:
    def test_to_citation_shape(self):
        chunk = RetrievedChunk(
            chunk_id="c1",
            document_id="d1",
            source="records",
            content="full content",
            snippet="full content",
            score=0.2,
        )
        citation = chunk.to_citation()
        assert citation == {
            "chunk_id": "c1",
            "document_id": "d1",
            "source": "records",
            "snippet": "full content",
        }
