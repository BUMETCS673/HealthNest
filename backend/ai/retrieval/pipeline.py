"""
AI-USAGE SUMMARY
Tools: Opus 4.7
Overall AI Contribution: ~65%
AI-Assisted Areas: Drafted the chunker (paragraph-first, then hard-split at ~1200 chars), the sha256 content-hash dedupe, and the per-document upsert that drops old chunks before re-embedding so re-ingest is idempotent.
Human Contributions: Decided the chunk size + overlap (small enough for tight citations, large enough that single-shot retrieval still returns useful context), wired the audit INGEST_RUN event with per-source counts, and made every chunk row carry patient_id denormalized so SCRUM-48's tenancy filter is a single .eq().
"""

from __future__ import annotations

import hashlib
from typing import Any

from auth.client import get_supabase_admin

from ai.audit import AuditKind, log as audit_log

from .adapters import ADAPTERS
from .embeddings import embed_many
from .sources import RetrievalSource


CHUNK_TARGET = 1200
CHUNK_OVERLAP = 150


def ingest_for_patient(
    *, patient_id: str, actor_user_id: str | None = None
) -> dict[str, Any]:
    admin = get_supabase_admin()
    sources_run: list[str] = []
    docs_upserted = 0
    chunks_upserted = 0

    for source, adapter in ADAPTERS.items():
        if not adapter.ready:
            continue
        sources_run.append(source.value)
        adapter_docs = adapter.load_documents(patient_id)
        for d in adapter_docs:
            content_hash = hashlib.sha256(d.content.encode("utf-8")).hexdigest()

            existing = (
                admin.table("rag_documents")
                .select("id, content_hash")
                .eq("patient_id", patient_id)
                .eq("source", source.value)
                .eq("source_ref", d.source_ref)
                .limit(1)
                .execute()
            ).data or []

            if existing and existing[0]["content_hash"] == content_hash:
                continue

            if existing:
                document_id = existing[0]["id"]
                admin.table("rag_documents").update(
                    {
                        "content_hash": content_hash,
                        "title": d.title,
                        "ingested_at": "now()",
                    }
                ).eq("id", document_id).execute()
                admin.table("rag_chunks").delete().eq(
                    "document_id", document_id
                ).execute()
            else:
                doc_row = (
                    admin.table("rag_documents")
                    .insert(
                        {
                            "patient_id": patient_id,
                            "source": source.value,
                            "source_ref": d.source_ref,
                            "title": d.title,
                            "content_hash": content_hash,
                        }
                    )
                    .execute()
                ).data
                if not doc_row:
                    continue
                document_id = doc_row[0]["id"]

            chunks = _chunk(d.content)
            if not chunks:
                continue
            vectors = embed_many(chunks)
            chunk_rows = [
                {
                    "document_id": document_id,
                    "patient_id": patient_id,
                    "source": source.value,
                    "chunk_index": idx,
                    "content": text,
                    "embedding": vec,
                }
                for idx, (text, vec) in enumerate(zip(chunks, vectors))
            ]
            admin.table("rag_chunks").insert(chunk_rows).execute()

            docs_upserted += 1
            chunks_upserted += len(chunk_rows)

    audit_log(
        AuditKind.INGEST_RUN,
        patient_id=patient_id,
        actor_user_id=actor_user_id,
        payload={
            "sources_run": sources_run,
            "documents_upserted": docs_upserted,
            "chunks_upserted": chunks_upserted,
        },
    )

    return {
        "sources_run": sources_run,
        "documents_upserted": docs_upserted,
        "chunks_upserted": chunks_upserted,
    }


def _chunk(text: str) -> list[str]:
    text = (text or "").strip()
    if not text:
        return []
    if len(text) <= CHUNK_TARGET:
        return [text]
    out: list[str] = []
    i = 0
    n = len(text)
    while i < n:
        end = min(n, i + CHUNK_TARGET)
        slice_ = text[i:end]
        if end < n:
            for sep in ("\n\n", "\n", ". "):
                cut = slice_.rfind(sep)
                if cut != -1 and cut > CHUNK_TARGET // 2:
                    end = i + cut + len(sep)
                    slice_ = text[i:end]
                    break
        out.append(slice_.strip())
        if end >= n:
            break
        i = max(end - CHUNK_OVERLAP, i + 1)
    return [c for c in out if c]
