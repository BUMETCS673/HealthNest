# AI-USAGE SUMMARY
# Tools: Claude Code (Opus 4.8)
# Overall AI Contribution: ~85%
# AI-Assisted Areas: FastAPI route for the notification feed (#SCRUM-76), scoped
#   to the current user via the auth dependency.
# Human Contributions: Reviewed the auth wiring.
# Notes: Validated via pytest and manual API testing.
from fastapi import APIRouter, Depends

from deps import current_user_id
from . import service

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/")
def list_notifications(user_id: str = Depends(current_user_id)):
    return service.get_notifications(user_id)
