"""
AI-USAGE SUMMARY
Tools: Opus 4.7
Overall AI Contribution: ~20%
AI-Assisted Areas: Suggested the package re-export pattern matching the existing auth module.
Human Contributions: Decided the module boundaries and what to surface from the package root.
"""

from .router import router

__all__ = ["router"]
