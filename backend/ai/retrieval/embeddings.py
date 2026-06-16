"""
AI-USAGE SUMMARY
Tools: Opus 4.7
Overall AI Contribution: ~60%
AI-Assisted Areas: Drafted the batching wrapper around openai.embeddings.create — splits input into chunks of 100 to stay under the per-request cap.
Human Contributions: Picked text-embedding-3-small (matches the pgvector(1536) column), made embed_one a thin wrapper so callers don't have to wrap a single string in a list themselves.
"""

from __future__ import annotations

from typing import Sequence

from ai.client import embed_model, get_openai


_BATCH = 100


def embed_many(texts: Sequence[str]) -> list[list[float]]:
    if not texts:
        return []
    out: list[list[float]] = []
    client = get_openai()
    model = embed_model()
    for i in range(0, len(texts), _BATCH):
        chunk = list(texts[i : i + _BATCH])
        resp = client.embeddings.create(model=model, input=chunk)
        out.extend([d.embedding for d in resp.data])
    return out


def embed_one(text: str) -> list[float]:
    return embed_many([text])[0]
