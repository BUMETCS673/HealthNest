"""
AI-USAGE SUMMARY
Tools: Opus 4.7
Overall AI Contribution: ~50%
AI-Assisted Areas: Drafted the stub shell so the source catalog has every member registered.
Human Contributions: Decided to ship this as a registered stub (returns []) rather than gate it out of the catalog — that keeps the pipeline/orchestrator code paths exercised against every source so the moment a care-team-directives table lands we only have to fill in load_documents().
"""

from __future__ import annotations

from .base import Document, SourceAdapter


class DirectivesAdapter(SourceAdapter):
    ready = False

    def load_documents(self, patient_id: str) -> list[Document]:
        return []
