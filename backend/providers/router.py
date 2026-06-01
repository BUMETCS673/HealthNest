# AI-USAGE SUMMARY 
# Tools: Claude Code
# Overall AI Contribution: ~80% 
# AI-Assisted Areas: Setting up the router and a get providers endpoint.
# Human Contributions: Business logic and validation.
# Notes: I verified that the router was configured correctly. I may modify it in future iterations and add more functionality, 
# I just used AI to help me quickly set up our prototype application. 


from fastapi import APIRouter

from .schemas import ProviderOut
from . import service

router = APIRouter(prefix="/providers", tags=["providers"])


@router.get("/", response_model=list[ProviderOut])
def list_providers():
    """Return all providers."""
    return service.get_providers()
