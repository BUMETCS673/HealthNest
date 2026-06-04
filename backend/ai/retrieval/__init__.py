"""
AI-USAGE SUMMARY
Tools: Opus 4.7
Overall AI Contribution: ~55%
AI-Assisted Areas: Drafted the package surface and the lazy adapter registry so import-time costs stay tiny.
Human Contributions: Decided to expose only the orchestrator + pipeline + sources from the package root — adapters are internal implementation details.
"""

from .orchestrator import RetrievalOrchestrator, RetrievedChunk
from .pipeline import ingest_for_patient
from .sources import RetrievalSource, SOURCE_CATALOG

__all__ = [
    "RetrievalOrchestrator",
    "RetrievedChunk",
    "RetrievalSource",
    "SOURCE_CATALOG",
    "ingest_for_patient",
]
