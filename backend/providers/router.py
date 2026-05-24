from fastapi import APIRouter

from .schemas import ProviderOut
from . import service

router = APIRouter(prefix="/providers", tags=["providers"])


@router.get("/", response_model=list[ProviderOut])
def list_providers():
    """Return all providers."""
    return service.get_providers()
