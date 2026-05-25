"""
AI-USAGE SUMMARY
Tools: Opus 4.7
Overall AI Contribution: ~20%
AI-Assisted Areas: Suggested the package re-export pattern matching the lab_results module.
Human Contributions: Decided that the patients package would only expose the router (no service helpers exported).
"""

from .router import router

__all__ = ["router"]
