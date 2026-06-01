"""
AI-USAGE SUMMARY
Model: ChatGPT-5
Overall AI Contribution: ~50%
AI-Assisted Areas: Added WebAuthn/biometric Pydantic models used by registration/login flows (start/finish request shapes and options response).
Human Contributions: Chose field names and validation (`EmailStr`) and reviewed model shapes to match existing `AuthResponse` usage.
"""

from typing import Any

from pydantic import BaseModel, EmailStr, Field


class SignUpRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    role: str = Field(pattern="^(patient|provider)$")
    first_name: str
    last_name: str
    date_of_birth: str | None = None
    sex_at_birth: str | None = None
    mrn: str | None = None


class SignInRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenRequest(BaseModel):
    access_token: str


class SessionPayload(BaseModel):
    access_token: str
    refresh_token: str
    expires_at: int | None = None
    expires_in: int | None = None
    token_type: str | None = None
    user: dict[str, Any]


class AuthResponse(BaseModel):
    session: SessionPayload | None = None
    user: dict[str, Any] | None = None
    message: str | None = None


# --- WebAuthn / Biometric schemas ---
class BiometricLoginStartRequest(BaseModel):
    email: EmailStr


class BiometricRegisterFinishRequest(BaseModel):
    credential: dict[str, Any]


class BiometricLoginFinishRequest(BaseModel):
    email: EmailStr
    credential: dict[str, Any]


class BiometricOptionsResponse(BaseModel):
    # The frontend expects a JSON-serializable options object for navigator.credentials
    options: dict[str, Any]
