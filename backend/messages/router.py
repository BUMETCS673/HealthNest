from fastapi import APIRouter, Depends, status
from deps import current_user_id
from .schemas import MessageCreate, MessageOut, ContactOut
from . import service

router = APIRouter(prefix="/messages", tags=["messages"])

@router.post("/", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
def send_message(payload: MessageCreate, sender_id: str = Depends(current_user_id)):
    return service.send_message(sender_id, payload)

@router.get("/inbox", response_model=list[MessageOut])
def get_inbox(user_id: str = Depends(current_user_id)):
    return service.get_inbox(user_id)

@router.get("/contacts", response_model=list[ContactOut])
def get_contacts(user_id: str = Depends(current_user_id)):
    return service.get_contacts(user_id)

@router.get("/thread/{contact_id}", response_model=list[MessageOut])
def get_thread(contact_id: str, user_id: str = Depends(current_user_id)):
    return service.get_thread(user_id, contact_id)

@router.patch("/thread/{contact_id}/read", status_code=status.HTTP_204_NO_CONTENT)
def mark_thread_read(contact_id: str, user_id: str = Depends(current_user_id)):
    service.mark_thread_read(user_id, contact_id)

@router.get("/unread")
def get_unread_counts(user_id: str = Depends(current_user_id)):
    return service.get_unread_counts(user_id)