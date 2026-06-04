"""
AI-USAGE SUMMARY
Tools: Claude (Opus 4.8)
Overall AI Contribution: ~85%
AI-Assisted Areas: Drafted the pytest cases for the ai.assistant streaming helpers — AssistantStreamEvent.to_sse, the _stream_text chunker, and _serialize_tool_call.
Human Contributions: Pinned the SSE wire shape ({"event", "data"} with JSON-encoded data) so the FastAPI EventSourceResponse stays a thin pass-through, and verified _stream_text reassembles to the original text losslessly.
"""

from __future__ import annotations

import json
from types import SimpleNamespace

from ai.assistant import (
    AssistantStreamEvent,
    _serialize_tool_call,
    _stream_text,
)


class TestAssistantStreamEvent:
    def test_to_sse_encodes_event_and_json_data(self):
        event = AssistantStreamEvent("delta", {"text": "hi"})
        sse = event.to_sse()
        assert sse["event"] == "delta"
        assert json.loads(sse["data"]) == {"text": "hi"}

    def test_done_event_defaults_to_empty_data(self):
        event = AssistantStreamEvent("done")
        assert json.loads(event.to_sse()["data"]) == {}


class TestStreamText:
    def test_reassembles_to_original(self):
        text = "The quick brown fox jumps over the lazy dog."
        assert "".join(_stream_text(text)) == text

    def test_respects_chunk_size(self):
        pieces = list(_stream_text("abcdefgh", chunk_size=4))
        assert pieces == ["abcd", "efgh"]

    def test_empty_text_yields_nothing(self):
        assert list(_stream_text("")) == []


class TestSerializeToolCall:
    def test_projects_openai_tool_call(self):
        tc = SimpleNamespace(
            id="call_1",
            function=SimpleNamespace(name="get_appointments", arguments='{"filter":"next"}'),
        )
        payload = _serialize_tool_call(tc)
        assert payload == {
            "id": "call_1",
            "type": "function",
            "function": {
                "name": "get_appointments",
                "arguments": '{"filter":"next"}',
            },
        }
