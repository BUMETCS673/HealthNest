"""
AI-USAGE SUMMARY
Tools: Opus 4.7
Overall AI Contribution: ~65%
AI-Assisted Areas: Drafted the projection from appointments + lab_results rows into a flat text Document so the embedding pipeline can chunk it uniformly.
Human Contributions: Reused appointments.service.get_appointments / lab_results.service.list_for_patient verbatim (no duplicated Supabase queries), and decided to emit one Document per appointment and one per released lab (rather than one mega-document per patient) so retrieval citations point at a specific record.
"""

from __future__ import annotations

from auth.client import get_supabase_admin

from .base import Document, SourceAdapter


class RecordsAdapter(SourceAdapter):
    ready = True

    def load_documents(self, patient_id: str) -> list[Document]:
        docs: list[Document] = []
        admin = get_supabase_admin()

        appts = (
            admin.table("appointments")
            .select("id, provider_name, specialty, location, appointment_date, "
                    "appointment_time, status, notes")
            .eq("patient_id", patient_id)
            .order("appointment_date", desc=True)
            .execute()
        ).data or []
        for a in appts:
            parts = [
                f"Appointment with {a.get('provider_name') or 'a provider'}",
                f"Specialty: {a.get('specialty')}" if a.get("specialty") else None,
                f"On {a.get('appointment_date')} at {a.get('appointment_time')}",
                f"Location: {a.get('location')}" if a.get("location") else None,
                f"Status: {a.get('status')}" if a.get("status") else None,
                f"Notes: {a.get('notes')}" if a.get("notes") else None,
            ]
            content = "\n".join(p for p in parts if p)
            docs.append(
                Document(
                    source_ref=f"appointments:{a['id']}",
                    title=f"Appointment — {a.get('provider_name') or 'provider'}",
                    content=content,
                )
            )

        labs = (
            admin.table("lab_results")
            .select("id, lab_name, ordering_provider_name, collected_at, "
                    "resulted_at, released_at, status")
            .eq("patient_id", patient_id)
            .eq("status", "released")
            .is_("deleted_at", None)
            .order("resulted_at", desc=True)
            .execute()
        ).data or []
        for r in labs:
            parts = [
                f"Lab result: {r.get('lab_name') or 'Unnamed lab'}",
                f"Ordering provider: {r.get('ordering_provider_name')}"
                if r.get("ordering_provider_name") else None,
                f"Collected: {r.get('collected_at')}" if r.get("collected_at") else None,
                f"Resulted: {r.get('resulted_at')}" if r.get("resulted_at") else None,
                f"Released: {r.get('released_at')}" if r.get("released_at") else None,
                f"Status: {r.get('status')}",
            ]
            content = "\n".join(p for p in parts if p)
            docs.append(
                Document(
                    source_ref=f"lab_results:{r['id']}",
                    title=f"Lab — {r.get('lab_name') or 'result'}",
                    content=content,
                )
            )
        return docs
