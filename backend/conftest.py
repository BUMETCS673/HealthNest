"""
AI-USAGE SUMMARY
Tools: Opus 4.7
Overall AI Contribution: ~60%
AI-Assisted Areas: Drafted the sys.path entry that lets pytest run from anywhere with the same import roots the FastAPI app uses.
Human Contributions: Decided to keep conftest.py at the backend root (matching the uvicorn working dir) so individual module tests don't need their own bootstrap.
"""


"""
AI-USAGE SUMMARY
Tools: Opus 4.7
Overall AI Contribution: ~40%
AI-Assisted Areas: Helped to set up pytest fixtures and test constants for authenticated and unauthenticated clients.
Human Contributions: Defined the structure of the fixtures and the test constants, ensuring they fit with our authentication system and testing needs.
"""

import os
import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from main import app
from deps import current_user_id


BACKEND_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(BACKEND_ROOT))

os.environ.setdefault("SUPABASE_URL", "http://localhost:54321")
os.environ.setdefault("SUPABASE_KEY", "test-anon-key")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "test-service-key")
os.environ.setdefault("OPENAI_API_KEY", "sk-test")
# Keep the test suite hermetic: the LLM safety adjudicator must never hit the
# network. Tests that exercise the LLM tier monkeypatch the classifier directly.
os.environ.setdefault("PULSE_SAFETY_LLM", "false")


FAKE_SENDER_ID    = "aaaaaaaa-0000-0000-0000-000000000001"
FAKE_RECIPIENT_ID = "bbbbbbbb-0000-0000-0000-000000000002"

@pytest.fixture
def client():
    """Authenticated test client — overrides JWT dependency."""
    app.dependency_overrides[current_user_id] = lambda: FAKE_SENDER_ID
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

@pytest.fixture
def anon_client():
    """Unauthenticated test client — no dependency override."""
    app.dependency_overrides.clear()
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c

@pytest.fixture
def context():
    """Shared dict for passing state between BDD steps."""
    return {}
