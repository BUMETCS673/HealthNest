"""
AI-USAGE SUMMARY 
Tools: Opus 4.7 
Overall AI Contribution: ~60% 
AI-Assisted Areas: Envelope encryption for *_enc PHI columns code
Human Contributions: Business logic, validation, error handling, security checks 
"""

from __future__ import annotations

import base64
import os
import secrets

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


VERSION = 1
_NONCE_LEN = 12
_DEK_LEN = 32
_WRAPPED_DEK_LEN = _DEK_LEN + 16  # AES-GCM tag is 16 bytes


class EnvelopeError(Exception):
    """Raised when an *_enc payload can't be encrypted or decrypted."""


def _load_kek() -> bytes:
    raw = os.environ.get("LAB_RESULTS_KEK")
    if not raw:
        raise EnvelopeError(
            "LAB_RESULTS_KEK must be set (base64-encoded 32-byte key)."
        )
    try:
        kek = base64.b64decode(raw, validate=True)
    except (ValueError, base64.binascii.Error) as exc:
        raise EnvelopeError("LAB_RESULTS_KEK is not valid base64.") from exc
    if len(kek) != 32:
        raise EnvelopeError("LAB_RESULTS_KEK must decode to exactly 32 bytes.")
    return kek


def encrypt(plaintext: str | None, *, aad: bytes) -> bytes | None:
    if plaintext is None:
        return None
    kek = _load_kek()
    dek = AESGCM.generate_key(bit_length=256)
    nonce_dek = secrets.token_bytes(_NONCE_LEN)
    nonce_pt = secrets.token_bytes(_NONCE_LEN)
    try:
        wrapped_dek = AESGCM(kek).encrypt(nonce_dek, dek, None)
        ciphertext = AESGCM(dek).encrypt(nonce_pt, plaintext.encode("utf-8"), aad)
    except Exception as exc:
        raise EnvelopeError("encryption failed") from exc
    return bytes([VERSION]) + nonce_dek + wrapped_dek + nonce_pt + ciphertext


def decrypt(blob: bytes | memoryview | None, *, aad: bytes) -> str | None:
    if blob is None:
        return None
    data = bytes(blob)
    if not data:
        return None
    if data[0] != VERSION:
        raise EnvelopeError(f"unsupported envelope version: {data[0]}")
    expected_min = 1 + _NONCE_LEN + _WRAPPED_DEK_LEN + _NONCE_LEN + 16
    if len(data) < expected_min:
        raise EnvelopeError("envelope payload is truncated")

    kek = _load_kek()
    o = 1
    nonce_dek = data[o : o + _NONCE_LEN]; o += _NONCE_LEN
    wrapped_dek = data[o : o + _WRAPPED_DEK_LEN]; o += _WRAPPED_DEK_LEN
    nonce_pt = data[o : o + _NONCE_LEN]; o += _NONCE_LEN
    ciphertext = data[o:]

    try:
        dek = AESGCM(kek).decrypt(nonce_dek, wrapped_dek, None)
        plaintext = AESGCM(dek).decrypt(nonce_pt, ciphertext, aad)
    except InvalidTag as exc:
        raise EnvelopeError("authentication failed (wrong key or tampered)") from exc
    except Exception as exc:
        raise EnvelopeError("decryption failed") from exc
    return plaintext.decode("utf-8")


def aad_for(table: str, row_id: str, column: str) -> bytes:
    return f"{table}:{row_id}:{column}".encode("utf-8")
