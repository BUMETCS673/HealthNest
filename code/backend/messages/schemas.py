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