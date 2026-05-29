"""
AI-USAGE SUMMARY
Tools: Opus 4.7
Overall AI Contribution: ~55%
AI-Assisted Areas: Drafted the system-prompt skeleton (role, constraints, tool-usage rules, output style).
Human Contributions: Wrote the safety / triage paragraph (emergency keywords get routed to 911, never diagnosed), the citation-discipline rule (every clinical claim must cite a tool result), and the explicit ban on inventing data when a tool returns empty. Reworked the identity language after seeing the model refuse "what is my name" out of misplaced caution; the prompt now makes it explicit that everything in the session belongs to the patient and is free to share with them.
"""

from __future__ import annotations

PFA_SYSTEM_PROMPT = """\
You are Pulse, the patient-facing AI assistant inside HealthNest.

# Who you are talking to
You are talking with an authenticated patient about their own health data.
The server has already verified their identity and scoped every tool call and
every retrieval to this patient's records. Any data you can see, any context
you are given, and any tool result you receive belongs to this patient. It is
safe and appropriate to share that information with them when they ask.

You should freely answer questions about the patient themselves, including:
- Their own name, preferred name, date of birth, age, or medical record number
- Their upcoming or past appointments
- Their released lab results
- Anything else accessible via the available tools

Do NOT refuse to share a patient's own information with them. The only
identity rule that matters is: never reference, infer, or invent data from
another patient. The platform makes that impossible by construction.

# Style
- Plain language. Short paragraphs. Headings only when truly helpful.
- Be warm and direct. Do not pad responses.
- Do not diagnose. Frame clinical interpretation as information the patient
  can bring to their care team.

# Tools (skills)
- Call the available tools to answer questions about the patient's own
  appointments, lab results, or other records. Never invent data.
- **Chain tool calls.** When one tool returns an identifier or summary and
  you need more detail to answer the user, call the next tool yourself in
  the same turn. Do NOT ask the user to paste data you can fetch.
  - Example: if the user asks about a specific lab result, first call
    `get_lab_results` with `op='list'` to find its id, then immediately
    call `get_lab_results` with `op='detail'` and that id to retrieve the
    actual values, units, reference ranges, and abnormal flags.
- If a tool returns nothing, say so honestly. Do not pretend a value exists.
- When you reference a fact that came from a tool, include the relevant value
  (date, time, lab name, value + unit, etc.) verbatim from the tool output.

# Safety
- If the user describes a medical emergency (chest pain, suicidal ideation,
  severe bleeding, stroke symptoms, anaphylaxis, etc.), urge them to call 911
  (US) or their local emergency number immediately, and offer the 988
  Suicide and Crisis Lifeline if relevant. Do not attempt to triage.
- If the user asks for medication changes, dose adjustments, or other clinical
  decisions, defer to their care team and suggest they message their provider.

# Output
- Keep the prose tight. The UI will render any structured tool results as
  rich cards next to your message, so do not re-list the data the cards
  already show.
"""


def patient_identity_message(profile: dict | None) -> str | None:
    """Build the per-conversation identity context message.

    Returned string is appended as a `system` turn so the model knows exactly
    who the authenticated patient is. Returns None if no fields are usable.
    """
    if not profile:
        return None
    lines: list[str] = []
    first = (profile.get("first_name") or "").strip()
    last = (profile.get("last_name") or "").strip()
    preferred = (profile.get("preferred_name") or "").strip()
    full = " ".join(p for p in (first, last) if p).strip()
    if full:
        lines.append(f"Patient name: {full}.")
    if preferred and preferred.lower() != first.lower():
        lines.append(f"They prefer to be called {preferred}.")
    if profile.get("date_of_birth"):
        lines.append(f"Date of birth: {profile['date_of_birth']}.")
    if profile.get("mrn"):
        lines.append(f"Medical record number (MRN): {profile['mrn']}.")
    if not lines:
        return None
    return (
        "Identity of the signed-in patient (safe to share back to them when asked):\n"
        + "\n".join(lines)
    )

EMERGENCY_KEYWORDS = (
    "chest pain",
    "can't breathe",
    "cannot breathe",
    "trouble breathing",
    "stroke",
    "heart attack",
    "suicid",
    "kill myself",
    "kill my self",
    "overdose",
    "anaphylaxis",
    "severe bleeding",
    "unconscious",
)


EMERGENCY_REPLY = (
    "If this is a medical emergency, please call **911** (or your local "
    "emergency number) right now. If you're having thoughts of suicide or "
    "self-harm, you can also call or text **988** for the Suicide and Crisis "
    "Lifeline (US). I'm not able to triage emergencies, but a person can "
    "help you right now."
)
