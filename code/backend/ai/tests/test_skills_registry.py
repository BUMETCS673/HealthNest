"""
AI-USAGE SUMMARY
Tools: Claude (Opus 4.8)
Overall AI Contribution: ~85%
AI-Assisted Areas: Drafted the pytest cases for ai.skills (SkillSpec.to_openai_tool, SkillRegistry CRUD + scope filtering, and the default_registry singleton), including the lightweight fake skill used as a fixture.
Human Contributions: Chose the scope matrix that matters (PFA_ONLY / DFA_ONLY / BOTH visibility) and verified the OpenAI tool-spec shape against what the assistant actually sends to the model.
"""

from __future__ import annotations

from typing import Any

from ai.skills.base import AISkill, Reply, SkillContext, SkillScope, SkillSpec
from ai.skills.registry import SkillRegistry, default_registry


class _FakeSkill(AISkill):
    def __init__(self, name: str, scope: SkillScope) -> None:
        self._name = name
        self._scope = scope

    def describe(self) -> SkillSpec:
        return SkillSpec(
            name=self._name,
            description=f"fake skill {self._name}",
            parameters={"type": "object", "properties": {}, "additionalProperties": False},
            scope=self._scope,
        )

    def run(self, ctx: SkillContext, **kwargs: Any) -> Reply:
        return Reply(summary="ok")


class TestSkillSpec:
    def test_to_openai_tool_shape(self):
        spec = SkillSpec(
            name="get_thing",
            description="desc",
            parameters={"type": "object", "properties": {}},
        )
        tool = spec.to_openai_tool()
        assert tool["type"] == "function"
        assert tool["function"]["name"] == "get_thing"
        assert tool["function"]["description"] == "desc"
        assert tool["function"]["strict"] is True

    def test_name_property_proxies_describe(self):
        skill = _FakeSkill("get_thing", SkillScope.BOTH)
        assert skill.name == "get_thing"


class TestSkillRegistry:
    def test_register_and_resolve(self):
        reg = SkillRegistry()
        skill = _FakeSkill("get_thing", SkillScope.BOTH)
        reg.register(skill)
        assert reg.resolve("get_thing") is skill

    def test_resolve_unknown_returns_none(self):
        assert SkillRegistry().resolve("nope") is None

    def test_list_for_includes_scope_and_both(self):
        reg = SkillRegistry()
        reg.register(_FakeSkill("pfa", SkillScope.PFA_ONLY))
        reg.register(_FakeSkill("dfa", SkillScope.DFA_ONLY))
        reg.register(_FakeSkill("both", SkillScope.BOTH))

        pfa_names = {s.name for s in reg.list_for(SkillScope.PFA_ONLY)}
        assert pfa_names == {"pfa", "both"}

        dfa_names = {s.name for s in reg.list_for(SkillScope.DFA_ONLY)}
        assert dfa_names == {"dfa", "both"}

    def test_openai_tool_specs_filtered_by_scope(self):
        reg = SkillRegistry()
        reg.register(_FakeSkill("pfa", SkillScope.PFA_ONLY))
        reg.register(_FakeSkill("dfa", SkillScope.DFA_ONLY))

        specs = reg.openai_tool_specs(SkillScope.PFA_ONLY)
        names = {s["function"]["name"] for s in specs}
        assert names == {"pfa"}

    def test_register_overwrites_same_name(self):
        reg = SkillRegistry()
        first = _FakeSkill("dup", SkillScope.BOTH)
        second = _FakeSkill("dup", SkillScope.BOTH)
        reg.register(first)
        reg.register(second)
        assert reg.resolve("dup") is second


class TestDefaultRegistry:
    def test_returns_singleton(self):
        assert default_registry() is default_registry()
