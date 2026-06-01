"""
AI-USAGE SUMMARY
Tools: Opus 4.7
Overall AI Contribution: ~60%
AI-Assisted Areas: Drafted the AISkill ABC + dataclasses (SkillSpec, SkillScope, Reply, SkillContext) so the registry/orchestrator can talk to skills via a single contract.
Human Contributions: Designed SkillScope (PFA-only vs DFA-only vs both) to match the class diagram, separated `summary` (model-visible text) from `payload` (UI-visible structured card data) on Reply, and made SkillContext carry both the authed patient_id and a free-form `meta` bag so skills don't have to plumb new args for new context fields.
"""

from __future__ import annotations

import abc
import enum
from dataclasses import dataclass, field
from typing import Any


class SkillScope(str, enum.Enum):
    PFA_ONLY = "pfa_only"
    DFA_ONLY = "dfa_only"
    BOTH = "both"


@dataclass
class SkillSpec:
    name: str
    description: str
    parameters: dict[str, Any]
    scope: SkillScope = SkillScope.BOTH
    strict: bool = True

    def to_openai_tool(self) -> dict[str, Any]:
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters,
                "strict": self.strict,
            },
        }


@dataclass
class SkillContext:
    patient_id: str
    user_id: str
    conversation_id: str | None = None
    meta: dict[str, Any] = field(default_factory=dict)


@dataclass
class Reply:

    summary: str
    payload: dict[str, Any] | None = None
    citations: list[dict[str, Any]] | None = None


class AISkill(abc.ABC):

    @abc.abstractmethod
    def describe(self) -> SkillSpec: ...

    @abc.abstractmethod
    def run(self, ctx: SkillContext, **kwargs: Any) -> Reply: ...

    @property
    def name(self) -> str:
        return self.describe().name
