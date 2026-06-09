from fastapi import APIRouter, Depends, status
from deps import current_user_id
from .schemas import MessageCreate, MessageOut
from . import service

router = APIRouter(prefix="/messages", tags=["messages"])

@router.post("/", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
def send_message(payload: MessageCreate, sender_id: str = Depends(current_user_id)):
    return service.send_message(sender_id, payload)

@router.get("/inbox", response_model=list[MessageOut])
def get_inbox(user_id: str = Depends(current_user_id)):
    return service.get_inbox(user_id)