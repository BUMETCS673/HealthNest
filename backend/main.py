# AI-USAGE SUMMARY
# Tools: Claude Code, Opus 4.7
# Overall AI Contribution: ~40%
# AI-Assisted Areas: Setting up the FastAPI application, configuring CORS middleware, and including routers for different modules. Opus 4.7 added the ai_router include for SCRUM-39 (Pulse AI Patient-Facing Assistant).
# Human Contributions: Defining the structure of the application, integrating different components, and ensuring that environment
# variables are handled correctly. Reviewed the ai_router include alongside the other module includes to confirm registration order doesn't matter here.
# Notes: AI was used to help quickly set up the basic structure of our FastAPI application and to configure CORS middleware.


import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from auth import router as auth_router
from appointments import router as appointments_router
from providers import router as providers_router
from lab_results import router as lab_results_router
from patients import router as patients_router
from ai import router as ai_router

app = FastAPI()

_default_origins = "http://localhost:5173,http://127.0.0.1:5173"
_allowed_origins = [
    origin.strip()
    for origin in os.environ.get("CORS_ALLOWED_ORIGINS", _default_origins).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
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


@app.get("/")
def root():
    return {"message": "Backend running"}
