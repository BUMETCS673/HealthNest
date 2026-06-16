# AI-USAGE SUMMARY
# Tools: Claude Code, Opus 4.7
# Overall AI Contribution: ~40%
# AI-Assisted Areas: Setting up the FastAPI application, configuring CORS middleware, and including routers for different modules. Opus 4.7 added the ai_router include for SCRUM-39 (Pulse AI Patient-Facing Assistant).
# Human Contributions: Defining the structure of the application, integrating different components, and ensuring that environment
# variables are handled correctly. Reviewed the ai_router include alongside the other module includes to confirm registration order doesn't matter here.
# Notes: AI was used to help quickly set up the basic structure of our FastAPI application and to configure CORS middleware.


import os
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from auth import router as auth_router
from appointments import router as appointments_router
from settings import settings
from providers import router as providers_router
from lab_results import router as lab_results_router
from patients import router as patients_router
from ai import router as ai_router, dfa_router
from messages import router as messages_router
from scheduling import router as scheduling_router
from notifications import router as notifications_router
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

app = FastAPI(
    title="HealthNest API",
    debug=settings.debug,
    docs_url="/docs" if settings.docs_enabled else None,
    redoc_url="/redoc" if settings.docs_enabled else None,
    openapi_url="/openapi.json" if settings.docs_enabled else None,
)

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)

        response.headers["Content-Security-Policy"] = (
            "default-src 'none'; "
            "frame-ancestors 'none'; "
            "base-uri 'none'; "
            "form-action 'none'"
        )
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=()"
        )

        return response


app.add_middleware(SecurityHeadersMiddleware)


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(appointments_router)
app.include_router(providers_router)
app.include_router(lab_results_router)
app.include_router(patients_router)
app.include_router(ai_router)
app.include_router(dfa_router)
app.include_router(messages_router)
app.include_router(scheduling_router)
app.include_router(notifications_router)



@app.get("/")
def root():
    return {"message": "Backend running"}


@app.get("/config")
def public_config():
    """Public browser config sourced from the backend environment
    (docker-compose). Anon key only — never the service key."""
    return {
        "supabase_url": os.environ.get("SUPABASE_URL"),
        "supabase_anon_key": os.environ.get("SUPABASE_KEY"),
    }


@app.exception_handler(Exception)
async def unhandled_exception_handler(
    request: Request,
    _exc: Exception,
) -> JSONResponse:
    logger.exception(
        "Unhandled error while processing %s %s",
        request.method,
        request.url.path,
    )

    return JSONResponse(
        status_code=500,
        content={"detail": "The request could not be completed."},
    )
