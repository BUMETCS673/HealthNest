"""
AI-USAGE SUMMARY
Tools: Opus 4.7
Overall AI Contribution: ~55%
AI-Assisted Areas: Drafted the SourceAdapter ABC + Document dataclass.
Human Contributions: Designed Document to carry a stable `source_ref` (e.g. 'appointments:<uuid>') so the pipeline can upsert idempotently against the (patient_id, source, source_ref) unique key in rag_documents.
"""

from __future__ import annotations

import abc
from dataclasses import dataclass


@dataclass
class Document:
    source_ref: str
    title: str
    content: str


class SourceAdapter(abc.ABC):
    ready: bool = False

    @abc.abstractmethod
    def load_documents(self, patient_id: str) -> list[Document]: ...
