"""
AI-USAGE SUMMARY
Tools: Opus 4.7
Overall AI Contribution: ~70%
AI-Assisted Areas: Drafted the AIAssistant abstract class + PatientFacingAssistant pipeline (guard -> retrieve -> agentic tool loop -> stream finalize) and the streaming token loop with OpenAI tool-call accumulation.
Human Contributions: Designed the AssistantStreamEvent surface (delta / skill_output / citation / done) so the FastAPI SSE endpoint stays a thin pass-through, kept retrieval optional (graceful when rag_chunks is empty), and made every external side effect (conversation append, audit emission) explicit at the top-level pipeline so the abstract class stays diagram-aligned. Added the multi-round tool loop so the model can chain dependent tool calls (e.g. lab_results op='list' to find the id, then op='detail' to fetch values) within a single user turn instead of giving up and asking the user to paste data.
"""

from __future__ import annotations

import abc
import json
import time
from dataclasses import dataclass, field
from typing import Any, Generator, Iterable

from auth.client import get_supabase_admin, with_admin_retry

from . import conversation, prompts
from .audit import AuditKind, log as audit_log
from .client import chat_model, get_openai
from .guard import screen as safety_screen
from .retrieval import RetrievalOrchestrator
from .safety import RiskCategory
from .skills import SkillContext, SkillScope, registry as skill_registry

MAX_TOOL_ROUNDS = 4


def _load_patient_profile(patient_id: str) -> dict[str, Any] | None:

    def _do() -> dict[str, Any] | None:
        resp = (
            get_supabase_admin()
            .table("patients")
            .select("id, first_name, last_name, preferred_name, mrn, date_of_birth")
            .eq("id", patient_id)
            .limit(1)
            .execute()
        )
        rows = resp.data or []
        return rows[0] if rows else None

    try:
        return with_admin_retry(_do)
    except Exception: 
        return None


@dataclass
class AssistantContext:
    patient_id: str
    user_id: str
    conversation_id: str
    assistant_type: str 


@dataclass
class AssistantStreamEvent:
    kind: str 
    data: dict[str, Any] = field(default_factory=dict)

    def to_sse(self) -> dict[str, str]:
        return {"event": self.kind, "data": json.dumps(self.data)}


class AIAssistant(abc.ABC):
    scope: SkillScope = SkillScope.BOTH
    system_prompt: str = ""

    @abc.abstractmethod
    def ask(
        self, ctx: AssistantContext, user_text: str
    ) -> Generator[AssistantStreamEvent, None, None]: ...


def _safety_audit_kind(guard: Any) -> AuditKind:
    if guard.category == RiskCategory.SELF_HARM_CRISIS:
        return AuditKind.SELF_HARM_DETECTED
    return AuditKind.EMERGENCY_DETECTED


def _emit_safety_response(
    ctx: AssistantContext, guard: Any, started: float
) -> Generator[AssistantStreamEvent, None, None]:
    """Stream the canned safety reply, persist it, and audit the detection.

    Shared by the patient- and provider-facing pipelines so emergency and
    self-harm routing behave identically and stay on one audit trail.
    """
    audit_log(
        _safety_audit_kind(guard),
        patient_id=ctx.patient_id,
        actor_user_id=ctx.user_id,
        conversation_id=ctx.conversation_id,
        payload={
            "category": guard.category.value,
            "confidence": guard.confidence,
            "tier": guard.tier,
            "signals": list(guard.signals),
        },
    )
    reply = guard.reply or ""
    for piece in _stream_text(reply):
        yield AssistantStreamEvent("delta", {"text": piece})
    conversation.append_message(
        conversation_id=ctx.conversation_id,
        role="assistant",
        content=reply,
        latency_ms=int((time.time() - started) * 1000),
    )
    yield AssistantStreamEvent("done", {"reason": guard.category.value})


class PatientFacingAssistant(AIAssistant):
    scope = SkillScope.PFA_ONLY
    system_prompt = prompts.PFA_SYSTEM_PROMPT

    def ask(
        self, ctx: AssistantContext, user_text: str
    ) -> Generator[AssistantStreamEvent, None, None]:
        started = time.time()
        conversation.append_message(
            conversation_id=ctx.conversation_id,
            role="user",
            content=user_text,
        )
        audit_log(
            AuditKind.MESSAGE_SENT,
            patient_id=ctx.patient_id,
            actor_user_id=ctx.user_id,
            conversation_id=ctx.conversation_id,
            payload={"length": len(user_text)},
        )
        guard = safety_screen(user_text)
        if guard.triggered:
            yield from _emit_safety_response(ctx, guard, started)
            return

        orchestrator = RetrievalOrchestrator(
            patient_id=ctx.patient_id, actor_user_id=ctx.user_id
        )
        chunks = orchestrator.retrieve(
            user_text, k=5, conversation_id=ctx.conversation_id
        )
        citations = [c.to_citation() for c in chunks]

        messages: list[dict[str, Any]] = [
            {"role": "system", "content": self.system_prompt}
        ]
        identity = prompts.patient_identity_message(
            _load_patient_profile(ctx.patient_id)
        )
        if identity:
            messages.append({"role": "system", "content": identity})
        messages.append(
            {"role": "system", "content": prompts.current_date_message()}
        )
        if chunks:
            messages.append(
                {
                    "role": "system",
                    "content": "Retrieved context (cite ids when used):\n"
                    + "\n---\n".join(
                        f"[{c.chunk_id}] ({c.source}) {c.content}" for c in chunks
                    ),
                }
            )
        messages.extend(
            conversation.history_for_openai(conversation_id=ctx.conversation_id)
        )

        client = get_openai()
        model = chat_model()
        tools = skill_registry.openai_tool_specs(self.scope)

        all_skill_outputs: list[dict[str, Any]] = []
        all_tool_call_payloads: list[dict[str, Any]] = []
        final_text: str | None = None

        for round_idx in range(MAX_TOOL_ROUNDS):
            completion = client.chat.completions.create(
                model=model, messages=messages, tools=tools, temperature=0.2
            )
            msg = completion.choices[0].message

            if not msg.tool_calls:
                final_text = msg.content or ""
                break


            round_payloads = [_serialize_tool_call(tc) for tc in msg.tool_calls]
            all_tool_call_payloads.extend(round_payloads)
            messages.append(
                {
                    "role": "assistant",
                    "content": msg.content or "",
                    "tool_calls": round_payloads,
                }
            )

            for tc in msg.tool_calls:
                fn = tc.function
                skill = skill_registry.resolve(fn.name)
                try:
                    args = json.loads(fn.arguments or "{}")
                except json.JSONDecodeError:
                    args = {}

                if skill is None:
                    tool_result: dict[str, Any] = {
                        "error": f"unknown skill '{fn.name}'",
                    }
                    audit_log(
                        AuditKind.SKILL_FAILED,
                        patient_id=ctx.patient_id,
                        actor_user_id=ctx.user_id,
                        conversation_id=ctx.conversation_id,
                        payload={"skill": fn.name, "reason": "not_registered"},
                    )
                else:
                    try:
                        reply = skill.run(
                            SkillContext(
                                patient_id=ctx.patient_id,
                                user_id=ctx.user_id,
                                conversation_id=ctx.conversation_id,
                            ),
                            **args,
                        )
                        tool_result = {
                            "summary": reply.summary,
                            "payload": reply.payload,
                        }
                        if reply.payload is not None:
                            sk_out = {
                                "skill": fn.name,
                                "payload": reply.payload,
                                "tool_call_id": tc.id,
                            }
                            all_skill_outputs.append(sk_out)
                        audit_log(
                            AuditKind.SKILL_DISPATCHED,
                            patient_id=ctx.patient_id,
                            actor_user_id=ctx.user_id,
                            conversation_id=ctx.conversation_id,
                            payload={
                                "skill": fn.name,
                                "round": round_idx,
                                "args_keys": list(args.keys()),
                            },
                        )
                    except Exception as exc:
                        tool_result = {"error": str(exc)}
                        audit_log(
                            AuditKind.SKILL_FAILED,
                            patient_id=ctx.patient_id,
                            actor_user_id=ctx.user_id,
                            conversation_id=ctx.conversation_id,
                            payload={"skill": fn.name, "error": str(exc)},
                        )

                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "name": fn.name,
                        "content": json.dumps(tool_result, default=str)[:8000],
                    }
                )
        else:
            forced = client.chat.completions.create(
                model=model, messages=messages, temperature=0.2
            )
            final_text = forced.choices[0].message.content or ""

        for sk_out in all_skill_outputs:
            yield AssistantStreamEvent("skill_output", sk_out)

        final_text = final_text or ""
        for piece in _stream_text(final_text):
            yield AssistantStreamEvent("delta", {"text": piece})

        for cite in citations:
            yield AssistantStreamEvent("citation", cite)

        latency = int((time.time() - started) * 1000)
        conversation.append_message(
            conversation_id=ctx.conversation_id,
            role="assistant",
            content=final_text,
            tool_calls=all_tool_call_payloads or None,
            skill_outputs=all_skill_outputs or None,
            citations=citations or None,
            latency_ms=latency,
        )

        audit_log(
            AuditKind.ASSISTANT_REPLIED,
            patient_id=ctx.patient_id,
            actor_user_id=ctx.user_id,
            conversation_id=ctx.conversation_id,
            payload={
                "tool_calls": len(all_skill_outputs),
                "tool_rounds": len([p for p in all_tool_call_payloads]),
            },
        )
        yield AssistantStreamEvent("done", {})

def _serialize_tool_call(tc: Any) -> dict[str, Any]:
    return {
        "id": tc.id,
        "type": "function",
        "function": {
            "name": tc.function.name,
            "arguments": tc.function.arguments,
        },
    }


def _stream_text(text: str, chunk_size: int = 4) -> Iterable[str]:
    for i in range(0, len(text), chunk_size):
        yield text[i : i + chunk_size]


def _load_provider_profile(provider_id: str) -> dict[str, Any] | None:
    """Load provider profile for the DFA identity message.

    Mirrors _load_patient_profile but queries the providers table.
    """
    def _do() -> dict[str, Any] | None:
        resp = (
            get_supabase_admin()
            .table("providers")
            .select("id, first_name, last_name, specialty")
            .eq("id", provider_id)
            .limit(1)
            .execute()
        )
        rows = resp.data or []
        return rows[0] if rows else None

    try:
        return with_admin_retry(_do)
    except Exception:
        return None


class DoctorFacingAssistant(AIAssistant):
    """Provider-facing Pulse assistant.

    Mirrors PatientFacingAssistant exactly — same pipeline:
    guard -> retrieve -> agentic tool loop -> stream finalize.
    Differences: DFA_ONLY skill scope, provider identity message,
    and audit calls carry provider_id in the patient_id slot so the
    existing audit schema stays unchanged.
    """

    scope = SkillScope.DFA_ONLY
    system_prompt = prompts.DFA_SYSTEM_PROMPT

    def ask(
        self, ctx: AssistantContext, user_text: str
    ) -> Generator[AssistantStreamEvent, None, None]:
        started = time.time()
        conversation.append_message(
            conversation_id=ctx.conversation_id,
            role="user",
            content=user_text,
        )
        audit_log(
            AuditKind.MESSAGE_SENT,
            patient_id=ctx.patient_id,
            actor_user_id=ctx.user_id,
            conversation_id=ctx.conversation_id,
            payload={"length": len(user_text)},
        )

        # Guard — same safety screen as PFA.
        guard = safety_screen(user_text)
        if guard.triggered:
            yield from _emit_safety_response(ctx, guard, started)
            return

        # Retrieve — same orchestrator as PFA; patient_id carries the
        # provider's scoped patient context passed in from the route.
        orchestrator = RetrievalOrchestrator(
            patient_id=ctx.patient_id, actor_user_id=ctx.user_id
        )
        chunks = orchestrator.retrieve(
            user_text, k=5, conversation_id=ctx.conversation_id
        )
        citations = [c.to_citation() for c in chunks]

        messages: list[dict[str, Any]] = [
            {"role": "system", "content": self.system_prompt}
        ]
        identity = prompts.provider_identity_message(
            _load_provider_profile(ctx.patient_id)
        )
        if identity:
            messages.append({"role": "system", "content": identity})
        if chunks:
            messages.append(
                {
                    "role": "system",
                    "content": "Retrieved context (cite ids when used):\n"
                    + "\n---\n".join(
                        f"[{c.chunk_id}] ({c.source}) {c.content}" for c in chunks
                    ),
                }
            )
        messages.extend(
            conversation.history_for_openai(conversation_id=ctx.conversation_id)
        )

        client = get_openai()
        model = chat_model()
        tools = skill_registry.openai_tool_specs(self.scope)

        all_skill_outputs: list[dict[str, Any]] = []
        all_tool_call_payloads: list[dict[str, Any]] = []
        final_text: str | None = None

        # Agentic tool loop — identical to PatientFacingAssistant.
        for round_idx in range(MAX_TOOL_ROUNDS):
            completion = client.chat.completions.create(
                model=model, messages=messages, tools=tools, temperature=0.2
            )
            msg = completion.choices[0].message

            if not msg.tool_calls:
                final_text = msg.content or ""
                break

            round_payloads = [_serialize_tool_call(tc) for tc in msg.tool_calls]
            all_tool_call_payloads.extend(round_payloads)
            messages.append(
                {
                    "role": "assistant",
                    "content": msg.content or "",
                    "tool_calls": round_payloads,
                }
            )

            for tc in msg.tool_calls:
                fn = tc.function
                skill = skill_registry.resolve(fn.name)
                try:
                    args = json.loads(fn.arguments or "{}")
                except json.JSONDecodeError:
                    args = {}

                if skill is None:
                    tool_result: dict[str, Any] = {
                        "error": f"unknown skill '{fn.name}'",
                    }
                    audit_log(
                        AuditKind.SKILL_FAILED,
                        patient_id=ctx.patient_id,
                        actor_user_id=ctx.user_id,
                        conversation_id=ctx.conversation_id,
                        payload={"skill": fn.name, "reason": "not_registered"},
                    )
                else:
                    try:
                        reply = skill.run(
                            SkillContext(
                                patient_id=ctx.patient_id,
                                user_id=ctx.user_id,
                                conversation_id=ctx.conversation_id,
                            ),
                            **args,
                        )
                        tool_result = {
                            "summary": reply.summary,
                            "payload": reply.payload,
                        }
                        if reply.payload is not None:
                            sk_out = {
                                "skill": fn.name,
                                "payload": reply.payload,
                                "tool_call_id": tc.id,
                            }
                            all_skill_outputs.append(sk_out)
                        audit_log(
                            AuditKind.SKILL_DISPATCHED,
                            patient_id=ctx.patient_id,
                            actor_user_id=ctx.user_id,
                            conversation_id=ctx.conversation_id,
                            payload={
                                "skill": fn.name,
                                "round": round_idx,
                                "args_keys": list(args.keys()),
                            },
                        )
                    except Exception as exc:
                        tool_result = {"error": str(exc)}
                        audit_log(
                            AuditKind.SKILL_FAILED,
                            patient_id=ctx.patient_id,
                            actor_user_id=ctx.user_id,
                            conversation_id=ctx.conversation_id,
                            payload={"skill": fn.name, "error": str(exc)},
                        )

                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "name": fn.name,
                        "content": json.dumps(tool_result, default=str)[:8000],
                    }
                )
        else:
            forced = client.chat.completions.create(
                model=model, messages=messages, temperature=0.2
            )
            final_text = forced.choices[0].message.content or ""

        # Stream finalize — identical to PatientFacingAssistant.
        for sk_out in all_skill_outputs:
            yield AssistantStreamEvent("skill_output", sk_out)

        final_text = final_text or ""
        for piece in _stream_text(final_text):
            yield AssistantStreamEvent("delta", {"text": piece})

        for cite in citations:
            yield AssistantStreamEvent("citation", cite)

        latency = int((time.time() - started) * 1000)
        conversation.append_message(
            conversation_id=ctx.conversation_id,
            role="assistant",
            content=final_text,
            tool_calls=all_tool_call_payloads or None,
            skill_outputs=all_skill_outputs or None,
            citations=citations or None,
            latency_ms=latency,
        )

        audit_log(
            AuditKind.ASSISTANT_REPLIED,
            patient_id=ctx.patient_id,
            actor_user_id=ctx.user_id,
            conversation_id=ctx.conversation_id,
            payload={
                "tool_calls": len(all_skill_outputs),
                "tool_rounds": len([p for p in all_tool_call_payloads]),
            },
        )
        yield AssistantStreamEvent("done", {})