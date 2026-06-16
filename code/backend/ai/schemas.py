"""
AI-USAGE SUMMARY
Tools: Opus 4.7
Overall AI Contribution: ~70%
AI-Assisted Areas: Drafted the Pydantic models for the assistant API surface (conversation create/list/get, message send, structured skill outputs, citations).
Human Contributions: Field naming to match the ai_conversations / ai_messages table columns 1:1 and the decision to keep skill_outputs / citations as opaque dict[str, Any] so adding a new skill never requires a schema migration.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class ConversationCreate(BaseModel):
    title: str | None = None


class ConversationSummary(BaseModel):
    id: str
    title: str | None = None
    started_at: str
    closed_at: str | None = None
    model: str
    last_message_at: str | None = None
    last_message_preview: str | None = None


class MessageOut(BaseModel):
    id: str
    conversation_id: str
    role: Literal["system", "user", "assistant", "tool"]
    skill: str | None = None
    content: str | None = None
    tool_calls: list[dict[str, Any]] | None = None
    skill_outputs: list[dict[str, Any]] | None = None
    citations: list[dict[str, Any]] | None = None
    created_at: str


class ConversationDetail(BaseModel):
    id: str
    title: str | None = None
    started_at: str
    closed_at: str | None = None
    model: str
    messages: list[MessageOut] = Field(default_factory=list)


class MessageSend(BaseModel):
    content: str = Field(min_length=1, max_length=8_000)
    stream: bool = True

class IngestResult(BaseModel):
    documents_upserted: int
    chunks_upserted: int
    sources_run: list[str]
