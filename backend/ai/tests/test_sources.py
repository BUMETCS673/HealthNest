"""
AI-USAGE SUMMARY
Tools: Claude (Opus 4.8)
Overall AI Contribution: ~85%
AI-Assisted Areas: Drafted the pytest cases for ai.retrieval.sources — the RetrievalSource enum and SOURCE_CATALOG readiness flags.
Human Contributions: Pinned the SCRUM-39 AT1 contract (records is the only ready source; billing / insurance / directives stay ready=False until their tables land) and confirmed SourceMeta is frozen so the catalog can't be mutated at runtime.
"""

from __future__ import annotations

import dataclasses

import pytest

from ai.retrieval.sources import SOURCE_CATALOG, RetrievalSource, SourceMeta


class TestRetrievalSource:
    def test_string_values(self):
        assert RetrievalSource.RECORDS.value == "records"
        assert RetrievalSource.BILLING.value == "billing"
        assert RetrievalSource.INSURANCE.value == "insurance"
        assert RetrievalSource.DIRECTIVES.value == "directives"


class TestSourceCatalog:
    def test_every_source_has_metadata(self):
        assert set(SOURCE_CATALOG.keys()) == set(RetrievalSource)

    def test_only_records_is_ready(self):
        ready = {s for s, meta in SOURCE_CATALOG.items() if meta.ready}
        assert ready == {RetrievalSource.RECORDS}

    def test_metadata_is_frozen(self):
        meta = SOURCE_CATALOG[RetrievalSource.RECORDS]
        assert isinstance(meta, SourceMeta)
        with pytest.raises(dataclasses.FrozenInstanceError):
            meta.ready = False  # type: ignore[misc]
