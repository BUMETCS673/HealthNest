"""
AI-USAGE SUMMARY
Tools: Claude (Opus 4.8)
Overall AI Contribution: ~85%
AI-Assisted Areas: Drafted the pytest cases for ai.client — the env-driven model selectors and the OpenAI singleton's missing-key guard.
Human Contributions: Pinned the documented defaults (PULSE_MODEL, PULSE_EMBED_MODEL, PULSE_DEIDENTIFY) and reset the cached client between cases so the missing-key RuntimeError is actually exercised rather than masked by the singleton.
"""

from __future__ import annotations

import pytest

import ai.client as client


class TestChatModel:
    def test_default(self, monkeypatch):
        monkeypatch.delenv("PULSE_MODEL", raising=False)
        assert client.chat_model() == "gpt-5.2"

    def test_override(self, monkeypatch):
        monkeypatch.setenv("PULSE_MODEL", "gpt-4o")
        assert client.chat_model() == "gpt-4o"


class TestEmbedModel:
    def test_default(self, monkeypatch):
        monkeypatch.delenv("PULSE_EMBED_MODEL", raising=False)
        assert client.embed_model() == "text-embedding-3-small"


class TestDeidentifyEnabled:
    def test_default_is_false(self, monkeypatch):
        monkeypatch.delenv("PULSE_DEIDENTIFY", raising=False)
        assert client.deidentify_enabled() is False

    @pytest.mark.parametrize("raw", ["1", "true", "TRUE", "yes"])
    def test_truthy_values(self, monkeypatch, raw):
        monkeypatch.setenv("PULSE_DEIDENTIFY", raw)
        assert client.deidentify_enabled() is True

    def test_other_values_are_false(self, monkeypatch):
        monkeypatch.setenv("PULSE_DEIDENTIFY", "maybe")
        assert client.deidentify_enabled() is False


class TestGetOpenAI:
    def test_raises_without_api_key(self, monkeypatch):
        monkeypatch.setattr(client, "_client", None)
        monkeypatch.delenv("OPENAI_API_KEY", raising=False)
        with pytest.raises(RuntimeError, match="OPENAI_API_KEY"):
            client.get_openai()

    def test_returns_cached_singleton(self, monkeypatch):
        monkeypatch.setattr(client, "_client", None)
        monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
        first = client.get_openai()
        second = client.get_openai()
        assert first is second
