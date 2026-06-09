"""
AI-USAGE SUMMARY
Tools: Claude (Opus 4.8)
Overall AI Contribution: ~85%
AI-Assisted Areas: Drafted the pytest cases for the ai.schemas Pydantic models — validation boundaries and default values.
Human Contributions: Chose the boundaries worth pinning (MessageSend min/max length and the stream default), and confirmed the field names match the ai_conversations / ai_messages columns the API serializes.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from ai.schemas import (
    ConversationCreate,
    ConversationSummary,
    IngestResult,
    MessageSend,
)


class TestMessageSend:
    def test_defaults_to_streaming(self):
        msg = MessageSend(content="hello")
        assert msg.stream is True

    def test_rejects_empty_content(self):
        with pytest.raises(ValidationError):
            MessageSend(content="")

    def test_rejects_content_over_limit(self):
        with pytest.raises(ValidationError):
            MessageSend(content="x" * 8_001)

    def test_accepts_content_at_limit(self):
        msg = MessageSend(content="x" * 8_000)
        assert len(msg.content) == 8_000

    def test_stream_can_be_disabled(self):
        assert MessageSend(content="hi", stream=False).stream is False


class TestConversationCreate:
    def test_title_is_optional(self):
        assert ConversationCreate().title is None

    def test_title_round_trips(self):
        assert ConversationCreate(title="Labs").title == "Labs"


class TestConversationSummary:
    def test_requires_core_fields(self):
        with pytest.raises(ValidationError):
            ConversationSummary(id="c1")  # missing started_at + model

    def test_builds_with_required_fields(self):
        summary = ConversationSummary(
            id="c1", started_at="2026-06-01T00:00:00Z", model="gpt-5.2"
        )
        assert summary.title is None
        assert summary.last_message_preview is None


class TestIngestResult:
    def test_carries_counts_and_sources(self):
        result = IngestResult(
            documents_upserted=2, chunks_upserted=7, sources_run=["records"]
        )
        assert result.documents_upserted == 2
        assert result.chunks_upserted == 7
        assert result.sources_run == ["records"]
