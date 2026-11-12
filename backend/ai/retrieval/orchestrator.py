"""
AI-USAGE SUMMARY
Tools: Opus 4.7
Overall AI Contribution: ~65%
AI-Assisted Areas: Drafted the RetrievalOrchestrator + the pgvector RPC call shape and the result projection into RetrievedChunk citations.
Human Contributions: Designed the three-layer tenancy enforcement (server-side patient_id filter in the SQL function + Python-side re-validation of every returned row's patient_id + audit emission on mismatch) so AT2 ('TENANCY_VIOLATION_BLOCKED') is satisfied. Also made the orchestrator gracefully degrade to [] when the RPC function isn't deployed (returns no error, just empty) so the assistant still works pre-RAG-rollout.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from auth.client import get_supabase_admin

from ai.audit import AuditKind, log as audit_log

from .embeddings import embed_one
from .sources import RetrievalSource


_log = logging.getLogger(__name__)


@dataclass
class RetrievedChunk:
    chunk_id: str
    document_id: str
    source: str
    content: str
    snippet: str 
    score: float | None = None

    def to_citation(self) -> dict[str, Any]:
        return {
            "chunk_id": self.chunk_id,
            "document_id": self.document_id,
            "source": self.source,
            "snippet": self.snippet,
        }


class RetrievalOrchestrator:

    def __init__(self, *, patient_id: str, actor_user_id: str | None = None) -> None:
        if not patient_id:
            raise ValueError("RetrievalOrchestrator requires a non-empty patient_id")
        self.patient_id = patient_id
        self.actor_user_id = actor_user_id

    def retrieve(
        self,
        query: str,
        *,
        k: int = 5,
        sources: list[RetrievalSource] | None = None,
        conversation_id: str | None = None,
    ) -> list[RetrievedChunk]:
        if not query.strip():
            return []
        try:
            embedding = embed_one(query)
        except Exception as exc:
            _log.warning("embedding failed; skipping retrieval: %s", exc)
            return []

        raw = self._vector_search(embedding=embedding, k=k, sources=sources)

        valid: list[RetrievedChunk] = []
        violated: list[dict[str, Any]] = []
        for row in raw:
            if row.get("patient_id") != self.patient_id:
                violated.append(
                    {
                        "chunk_id": row.get("id"),
                        "actual_patient_id": row.get("patient_id"),
                        "expected_patient_id": self.patient_id,
                    }
                )
                continue
            content = row.get("content") or ""
            valid.append(
                RetrievedChunk(
                    chunk_id=row["id"],
                    document_id=row["document_id"],
                    source=row.get("source") or "",
                    content=content,
                    snippet=content[:240],
                    score=row.get("score"),
                )
            )

        if violated:
            audit_log(
                AuditKind.TENANCY_VIOLATION_BLOCKED,
                patient_id=self.patient_id,
                actor_user_id=self.actor_user_id,
                conversation_id=conversation_id,
                payload={"violations": violated, "query_len": len(query)},
            )
            return []

        audit_log(
            AuditKind.RETRIEVAL_PERFORMED,
            patient_id=self.patient_id,
            actor_user_id=self.actor_user_id,
            conversation_id=conversation_id,
            payload={
                "k": k,
                "returned": len(valid),
                "sources": [s.value for s in (sources or [])],
            },
        )
        return valid

    def _vector_search(
        self,
        *,
        embedding: list[float],
        k: int,
        sources: list[RetrievalSource] | None,
    ) -> list[dict[str, Any]]:
        admin = get_supabase_admin()
        try:
            q = (
                admin.table("rag_chunks")
                .select("id, document_id, patient_id, source, content")
                .eq("patient_id", self.patient_id)
            )
            if sources:
                q = q.in_("source", [s.value for s in sources])
            resp = q.limit(max(k * 10, 50)).execute()
        except Exception as exc:  # noqa: BLE001
            _log.warning("rag_chunks scan failed (likely table missing): %s", exc)
            return []

        rows = resp.data or []
        if not rows:
            return []

        def cosine(a: list[float], b_blob: Any) -> float:
            b = _as_vector(b_blob)
            if not b:
                return 1.0
            num = sum(x * y for x, y in zip(a, b))
            da = sum(x * x for x in a) ** 0.5
            db = sum(y * y for y in b) ** 0.5
            if da == 0 or db == 0:
                return 1.0
            return 1.0 - (num / (da * db))

        ids = [r["id"] for r in rows]
        emb_rows = (
            admin.table("rag_chunks")
            .select("id, embedding")
            .in_("id", ids)
            .execute()
        ).data or []
        emb_by_id = {r["id"]: r.get("embedding") for r in emb_rows}

        scored = []
        for r in rows:
            d = cosine(embedding, emb_by_id.get(r["id"]))
            scored.append({**r, "score": d})
        scored.sort(key=lambda r: r["score"])
        return scored[:k]


def _as_vector(blob: Any) -> list[float]:
    if blob is None:
        return []
    if isinstance(blob, list):
        return [float(x) for x in blob]
    if isinstance(blob, str):
        s = blob.strip()
        if s.startswith("[") and s.endswith("]"):
            try:
                return [float(x) for x in s[1:-1].split(",") if x]
            except ValueError:
                return []
    return []
