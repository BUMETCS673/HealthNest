"""
AI-USAGE SUMMARY
Tools: Opus 4.7
Overall AI Contribution: ~60%
AI-Assisted Areas: Drafted the sys.path entry that lets pytest run from anywhere with the same import roots the FastAPI app uses.
Human Contributions: Decided to keep conftest.py at the backend root (matching the uvicorn working dir) so individual module tests don't need their own bootstrap.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(BACKEND_ROOT))

os.environ.setdefault("SUPABASE_URL", "http://localhost:54321")
os.environ.setdefault("SUPABASE_KEY", "test-anon-key")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "test-service-key")
os.environ.setdefault("OPENAI_API_KEY", "sk-test")
