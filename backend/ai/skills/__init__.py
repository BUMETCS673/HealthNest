"""
AI-USAGE SUMMARY
Tools: Opus 4.7
Overall AI Contribution: ~60%
AI-Assisted Areas: Drafted the default registry boot — registers every shipped skill at import time so the assistant always has a populated catalog.
Human Contributions: Decided to centralize registration here (instead of forcing each importer to wire skills) and picked the order so that the OpenAI tool list is stable run-to-run.
"""

from .base import AISkill, Reply, SkillContext, SkillScope, SkillSpec
from .registry import SkillRegistry, default_registry
from .appointments_skill import AppointmentsSkill
from .lab_results_skill import LabResultsSkill


def _bootstrap() -> SkillRegistry:
    reg = default_registry()
    reg.register(AppointmentsSkill())
    reg.register(LabResultsSkill())
    return reg


registry = _bootstrap()


__all__ = [
    "AISkill",
    "AppointmentsSkill",
    "LabResultsSkill",
    "Reply",
    "SkillContext",
    "SkillRegistry",
    "SkillScope",
    "SkillSpec",
    "registry",
]
