"""
AI-USAGE SUMMARY
Tools: Opus 4.7
Overall AI Contribution: ~55%
AI-Assisted Areas: Drafted the enum + the SOURCE_CATALOG dict literal.
Human Contributions: Picked the four sources to exactly match SCRUM-39 AT1 (records, billing, insurance, directives) so the orchestrator can fan out across them once the data lands; flagged the three non-records sources as `ready=False` so /ai/ingest skips them quietly.
"""

from __future__ import annotations

import enum
from dataclasses import dataclass


class RetrievalSource(str, enum.Enum):
    RECORDS = "records"
    BILLING = "billing"
    INSURANCE = "insurance"
    DIRECTIVES = "directives"


@dataclass(frozen=True)
class SourceMeta:
    source: RetrievalSource
    display_name: str
    description: str
    ready: bool


SOURCE_CATALOG: dict[RetrievalSource, SourceMeta] = {
    RetrievalSource.RECORDS: SourceMeta(
        source=RetrievalSource.RECORDS,
        display_name="Medical records",
        description="Appointments and released lab results for the patient.",
        ready=True,
    ),
    RetrievalSource.BILLING: SourceMeta(
        source=RetrievalSource.BILLING,
        display_name="Billing",
        description="Claims, charges, and balances.",
        ready=False,
    ),
    RetrievalSource.INSURANCE: SourceMeta(
        source=RetrievalSource.INSURANCE,
        display_name="Insurance",
        description="Plan benefits, formulary, prior-auth requirements.",
        ready=False,
    ),
    RetrievalSource.DIRECTIVES: SourceMeta(
        source=RetrievalSource.DIRECTIVES,
        display_name="Care-team directives",
        description="Standing orders and care plans from the patient's providers.",
        ready=False,
    ),
}
