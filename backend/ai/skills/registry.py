"""
AI-USAGE SUMMARY
Tools: Opus 4.7
Overall AI Contribution: ~55%
AI-Assisted Areas: Drafted the SkillRegistry CRUD (register/resolve/list_for) and the OpenAI tool-spec collection helper.
Human Contributions: Decided that the registry is owned per-process (a single default_registry singleton) and that scope filtering lives in list_for() instead of being baked into each assistant — that keeps the AIAssistant abstract class diagram-aligned with the design.
"""

from __future__ import annotations

from typing import Any

from .base import AISkill, SkillScope


class SkillRegistry:
    def __init__(self) -> None:
        self._skills: dict[str, AISkill] = {}

    def register(self, skill: AISkill) -> None:
        self._skills[skill.name] = skill

    def resolve(self, name: str) -> AISkill | None:
        return self._skills.get(name)

    def list_for(self, scope: SkillScope) -> list[AISkill]:
        return [
            s for s in self._skills.values()
            if s.describe().scope in {scope, SkillScope.BOTH}
        ]

    def openai_tool_specs(self, scope: SkillScope) -> list[dict[str, Any]]:
        return [s.describe().to_openai_tool() for s in self.list_for(scope)]


_default: SkillRegistry | None = None


def default_registry() -> SkillRegistry:
    global _default
    if _default is None:
        _default = SkillRegistry()
    return _default
