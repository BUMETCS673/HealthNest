# AI-USAGE SUMMARY
# Tools: Claude Code (Opus 4.8)
# Overall AI Contribution: ~40%
# AI-Assisted Areas: Pydantic models for message create/out and contacts.
# Human Contributions: Field and validation choices.
# Notes: Validated via py_compile.
from pydantic import BaseModel

class MessageCreate(BaseModel):
    recipient_id: str
    body: str               # required — empty body should 422

class MessageOut(BaseModel):
    id: str
    sender_id: str
    recipient_id: str
    body: str
    sent_at: str
    read_at: str | None = None

class ContactOut(BaseModel):
    user_id: str                 # the counterpart's auth id → use as recipient_id
    name: str
    specialty: str | None = None