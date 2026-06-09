"""
AI-USAGE SUMMARY
Tools: Claude (Opus 4.8)
Overall AI Contribution: ~85%
AI-Assisted Areas: Drafted the pytest cases for the ai.retrieval.pipeline._chunk splitter — empty input, short single-chunk input, and long input that must split on natural boundaries with overlap.
Human Contributions: Pinned the chunk-size contract (single chunk when <= CHUNK_TARGET, multiple otherwise) and verified the overlap keeps chunks non-empty so re-embedding stays idempotent.
"""

from __future__ import annotations

from ai.retrieval.pipeline import CHUNK_TARGET, _chunk


class TestChunk:
    def test_empty_string_returns_no_chunks(self):
        assert _chunk("") == []

    def test_whitespace_only_returns_no_chunks(self):
        assert _chunk("   \n  \n ") == []

    def test_short_text_is_one_chunk(self):
        assert _chunk("hello world") == ["hello world"]

    def test_text_at_target_stays_single(self):
        text = "a" * CHUNK_TARGET
        assert _chunk(text) == [text]

    def test_long_text_splits_into_multiple_chunks(self):
        text = "\n\n".join(["paragraph " * 40 for _ in range(6)])
        chunks = _chunk(text)
        assert len(chunks) > 1

    def test_chunks_are_never_empty(self):
        text = ("word " * 600).strip()
        chunks = _chunk(text)
        assert chunks
        assert all(c.strip() for c in chunks)

    def test_prefers_paragraph_boundary(self):
        head = "x" * 800
        tail = "y" * 800
        chunks = _chunk(f"{head}\n\n{tail}")
        # The split should land on the blank line, so the first chunk is the
        # head paragraph rather than a hard mid-word cut.
        assert chunks[0].startswith("x")
        assert chunks[0].rstrip().endswith("x")
