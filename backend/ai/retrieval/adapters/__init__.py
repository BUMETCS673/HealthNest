"""
AI-USAGE SUMMARY
Tools: Opus 4.7
Overall AI Contribution: ~55%
AI-Assisted Areas: Drafted the package surface — every shipped adapter is exported here so the pipeline can iterate the catalog without touching individual files.
Human Contributions: Picked the registration shape (a plain dict keyed by RetrievalSource) so SCRUM-46's promise of 'pluggable per-source adapters' is genuinely one line to extend.
"""

from ai.retrieval.sources import RetrievalSource
from .base import Document, SourceAdapter
from .records_adapter import RecordsAdapter
from .billing_adapter import BillingAdapter
from .insurance_adapter import InsuranceAdapter
from .directives_adapter import DirectivesAdapter


ADAPTERS: dict[RetrievalSource, SourceAdapter] = {
    RetrievalSource.RECORDS: RecordsAdapter(),
    RetrievalSource.BILLING: BillingAdapter(),
    RetrievalSource.INSURANCE: InsuranceAdapter(),
    RetrievalSource.DIRECTIVES: DirectivesAdapter(),
}


__all__ = [
    "ADAPTERS",
    "BillingAdapter",
    "DirectivesAdapter",
    "Document",
    "InsuranceAdapter",
    "RecordsAdapter",
    "SourceAdapter",
]
