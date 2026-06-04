"""
AI-USAGE SUMMARY
Tools: Opus 4.7
Overall AI Contribution: ~70%
AI-Assisted Areas: Drafted the OpenAI client singleton in the same shape as auth/client.get_supabase so the rest of the backend looks/feels consistent.
Human Contributions: Picked the env var names (PULSE_MODEL, PULSE_EMBED_MODEL), defaulted the chat model to gpt-4o and the embed model to text-embedding-3-small so they line up with the 1536-dim pgvector column.
"""

from __future__ import annotations

import os

from openai import OpenAI


_client: OpenAI | None = None


def get_openai() -> OpenAI:
    global _client
    if _client is None:
        key = os.environ.get("OPENAI_API_KEY")
        if not key:
            raise RuntimeError(
                "OPENAI_API_KEY must be set in the backend environment for Pulse AI"
            )
        _client = OpenAI(api_key=key)
    return _client


def chat_model() -> str:
    return os.environ.get("PULSE_MODEL", "gpt-5.2")


def embed_model() -> str:
    return os.environ.get("PULSE_EMBED_MODEL", "text-embedding-3-small")


def deidentify_enabled() -> bool:
    return os.environ.get("PULSE_DEIDENTIFY", "false").lower() in {"1", "true", "yes"}
