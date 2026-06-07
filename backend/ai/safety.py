"""
AI-USAGE SUMMARY
Tools: Claude (Opus 4.8)
Overall AI Contribution: ~75%
AI-Assisted Areas: Drafted the two-category signal tables (medical emergency vs.
self-harm crisis), the context-gating regexes (negation / historical / hypothetical /
activity), and the confidence scoring that decides fire-now vs. ask-the-LLM vs. ignore.
Human Contributions: Set the policy that drives the whole module — detection must be
RECALL-safe on genuine active emergencies but PRECISION-safe everywhere else so Pulse is
not overprotective. Picked which phrases are strong enough to fire on their own, which must
be backed by present-tense activity, and which only ever reach MEDIUM so the LLM tier (and
not a brittle keyword) makes the borderline call. Encoded crisis-specific negation
("don't want to die" reassures, "don't want to live" does not) by hand because generic
windowed negation gets that backwards. Wrote the standards-aligned replies (911 for
medical, 988 / text 741741 / warm human handoff for crisis).

This module is the deterministic Tier 1 of the safety layer. It performs NO network I/O so
it stays fast, free, and unit-testable. `ai.guard.screen` orchestrates this with the
optional LLM adjudicator in `ai.safety_classifier`.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from enum import Enum


class RiskCategory(str, Enum):
    NONE = "none"
    MEDICAL_EMERGENCY = "medical_emergency"
    SELF_HARM_CRISIS = "self_harm_crisis"


# Confidence levels. HIGH => fire on Tier 1 alone. MEDIUM => ambiguous, hand to the
# LLM adjudicator. NONE => no safety routing (suppressed or not a risk signal).
HIGH = "high"
MEDIUM = "medium"
NONE = "none"


# --------------------------------------------------------------------------- #
# Standards-aligned responses
# --------------------------------------------------------------------------- #

MEDICAL_EMERGENCY_REPLY = (
    "This sounds like it could be a medical emergency. **Please call 911 now** "
    "(or your local emergency number), or go to the nearest emergency room. If "
    "someone is with you, ask them to help you get care right away.\n\n"
    "I'm an AI assistant — I can't provide emergency care or decide how urgent "
    "this is, so please reach emergency services or a clinician immediately. "
    "Once you're safe, I'm here to help with your appointments and records."
)

SELF_HARM_CRISIS_REPLY = (
    "I'm really glad you told me, and I'm sorry you're carrying this right now. "
    "You deserve support from a real person, and help is available immediately:\n\n"
    "- **Call or text 988** to reach the 988 Suicide & Crisis Lifeline (US) — "
    "trained counselors are there any time, day or night.\n"
    "- **Text HOME to 741741** to reach the Crisis Text Line.\n"
    "- If you're in immediate danger or thinking about acting on these thoughts, "
    "**please call 911** or go to your nearest emergency room.\n\n"
    "If you can, reaching out to someone you trust or your care team can help too. "
    "I'm not able to provide crisis counseling myself, but the counselors at 988 "
    "are there for exactly this and can talk with you right now."
)

REPLY_FOR = {
    RiskCategory.MEDICAL_EMERGENCY: MEDICAL_EMERGENCY_REPLY,
    RiskCategory.SELF_HARM_CRISIS: SELF_HARM_CRISIS_REPLY,
}


# --------------------------------------------------------------------------- #
# Signal tables — (label, pattern). Patterns use word boundaries so "stroke"
# never matches "backstroke"/"keystroke" and "suicid" only matches real words.
# --------------------------------------------------------------------------- #

MEDICAL_SIGNALS: tuple[tuple[str, str], ...] = (
    ("chest_pain", r"\bchest (pain|pressure|tightness|tightening|discomfort)\b"
                   r"|\bchest (hurts?|is killing me)\b|\bmy chest hurts?\b"),
    ("crushing_chest", r"\bcrushing (chest|pain)\b"),
    ("faint", r"\b(going to|about to|gonna) pass out\b|\bpassing out\b|\bfeel faint\b"),
    ("heart_attack", r"\bheart attack\b"),
    ("cardiac_arrest", r"\bcardiac arrest\b"),
    ("stroke", r"\bstroke\b"),
    ("cant_breathe", r"\bcan'?t breathe\b|\bcannot breathe\b|\bcan not breathe\b"),
    ("trouble_breathing", r"\b(trouble|difficulty|hard time) breathing\b"),
    ("cant_catch_breath", r"\bcan'?t catch my breath\b"),
    ("gasping", r"\bgasping for (air|breath)\b"),
    ("choking", r"\bchoking\b"),
    ("throat_closing", r"\bthroat (is )?(closing|swelling|swollen)\b"),
    ("anaphylaxis", r"\banaphylaxis\b|\banaphylactic\b"),
    ("severe_bleeding", r"\bsevere bleeding\b|\bbleeding (won'?t|will not) stop\b"
                        r"|\bbleeding (heavily|badly|a lot)\b|\bhemorrhag"),
    ("bleeding_out", r"\bbleeding out\b"),
    ("unconscious", r"\bunconscious\b|\bunresponsive\b|\bpassed out\b|\bnot breathing\b"),
    ("seizure", r"\b(having|had) a seizure\b|\bconvulsing\b"),
    ("stroke_fast", r"\bslurred speech\b|\bface (is )?drooping\b"),
    ("sudden_numbness", r"\bsudden(ly)? (numb|weakness|numbness)\b"
                        r"|\bnumbness (on|down) (one|the (left|right)) side\b"),
    ("overdose", r"\boverdose\b|\boverdosed\b"),
)

# Medical signals strong enough to route on their own (no present-tense marker needed),
# because they are almost never benign in first person.
STRONG_MEDICAL = {
    "cant_breathe", "trouble_breathing", "cant_catch_breath", "gasping",
    "throat_closing", "anaphylaxis", "severe_bleeding", "bleeding_out",
    "unconscious", "cardiac_arrest", "crushing_chest",
}

SELF_HARM_SIGNALS: tuple[tuple[str, str], ...] = (
    ("suicidal", r"\bsuicid\w*\b"),
    ("kill_myself", r"\bkill(ing)? (myself|my self)\b"),
    ("end_my_life", r"\b(end|ending) (my|this) life\b|\bend it all\b"),
    ("take_own_life", r"\btak(e|ing) my own life\b"),
    ("want_to_die", r"\bwant to die\b|\bwanna die\b"),
    ("wish_dead", r"\bwish i (was|were) dead\b"),
    ("better_off_dead", r"\bbetter off dead\b|\bbetter off without me\b"),
    ("dont_want_to_live", r"\bdon'?t want to (live|be alive|be here|wake up|exist)\b"
                          r"|\bdon'?t want to be here anymore\b"),
    ("no_reason_to_live", r"\bno (reason|point) (to|in) (live|living|life|go on|going on)\b"),
    ("self_harm", r"\b(hurt|harm|cut) (myself|my self)\b"
                  r"|\b(hurting|harming|cutting) myself\b|\bself[- ]harm\b"),
    ("cant_go_on", r"\bcan'?t go on\b|\bcan'?t do this anymore\b|\bcan'?t take (it|this) anymore\b"),
    ("took_pills", r"\btook (all|a bunch of|too many|the rest of)\b[^.?!]{0,12}\bpills\b"),
)

# Self-harm signals that, on their own, express first-person intent strongly enough
# to route without a separate activity marker. "suicidal" / "can't go on" stay OUT —
# they're real but ambiguous (history, third party, figurative) and go to MEDIUM.
STRONG_SELF_HARM = {
    "kill_myself", "end_my_life", "take_own_life", "want_to_die",
    "wish_dead", "better_off_dead", "dont_want_to_live", "no_reason_to_live",
    "self_harm", "took_pills",
}

# Figurative / highly ambiguous signals that must never escalate to HIGH on their
# own — "I can't go on (with this diet)". They stay MEDIUM so the LLM tier decides.
WEAK_SELF_HARM = {"cant_go_on"}


# --------------------------------------------------------------------------- #
# Context gating
# --------------------------------------------------------------------------- #

# Idioms that look like a signal but are not. Removed before scanning.
_SAFE_IDIOMS = (
    r"\bstroke of (luck|genius|brilliance|the (pen|brush|clock))\b",
    r"\bdifferent strokes\b",
    r"\bkeystroke\b|\bbackstroke\b|\bbreaststroke\b",
)

# Reassurance / denial specific to self-harm. The harm token must sit within a short
# window of the negator so we don't suppress a real disclosure two clauses away.
_SELF_HARM_REASSURE = (
    r"\bnot (feeling )?suicidal\b",
    r"\bno (thoughts of|intention of|intent to|plan to|plans to|desire to)\b",
    r"\bdenies (si|suicidal ideation|self[- ]harm|sh)\b",
    r"\b(never|wouldn'?t|won'?t|would not|will not|don'?t|do not|not going to|"
    r"no longer|would never)\b[^.?!]{0,15}\b(kill myself|hurt myself|harm myself|"
    r"end my life|end it|take my own life|want to die|wanna die|commit suicide|suicid\w*)\b",
)

# Generic negation used only for MEDICAL symptoms: negator shortly before the symptom.
_MEDICAL_NEGATORS = (
    r"\bno\b", r"\bnot\b", r"\bnever\b", r"\bwithout\b", r"\bdon'?t have\b",
    r"\bdoesn'?t have\b", r"\bdidn'?t have\b", r"\bdenies?\b", r"\bdenied\b",
    r"\bnegative for\b", r"\bruled out\b", r"\bfree of\b", r"\bno more\b",
    r"\bno longer have\b",
)

_HISTORICAL = (
    r"\blast (week|month|year|night|time|few (days|weeks|months))\b",
    r"\b\d*\s*(years?|months?|weeks?|days?|hours?) ago\b",
    r"\bin the past\b", r"\bpreviously\b", r"\bused to\b", r"\bonce had\b",
    r"\bhistory of\b", r"\bpast (medical )?history\b", r"\bback in (19|20)\d{2}\b",
    r"\bwhen i was (a (kid|child|teenager|baby)|younger|\d+)\b",
    r"\ba (while|long time) ago\b", r"\bearlier this (year|month)\b",
    r"\bhad .{0,30}(before|in the past|years? ago|months? ago)\b",
)

_INFORMATIONAL = (
    r"\bwhat (is|are|causes|happens|does|do|count)\b",
    r"\bwhat should i do if\b", r"\bwhat to do (if|when|for|about)\b",
    r"\bwarning signs?\b", r"\bsymptoms? of\b", r"\bsigns? of\b",
    r"\bhow (do|can|would|should|will) i (know|tell|recognize|prevent|avoid|spot)\b",
    r"\bhow to (prevent|recognize|spot|avoid|treat|reduce)\b",
    r"\bfor (my|a|an) (class|exam|test|assignment|paper|study|studies|research|"
    r"nursing|homework|course|presentation|project)\b",
    r"\bdefinition of\b", r"\bwhat does .{0,40}mean\b",
    r"\bam i at risk\b", r"\brisk (of|factors?|factor)\b",
    r"\bcan you (explain|tell me about|describe|teach)\b",
    r"\bcurious about\b", r"\b(learn|read)(ing)? about\b", r"\breading about\b",
    r"\bjust wondering\b", r"\bhypothetical", r"\bin general\b",
)

# First-person framed hypothetically — "if I ...". Present-tense markers override this.
_HYPOTHETICAL_FIRST_PERSON = (
    r"\bif i (ever|were to|had|get|got|have|develop|start)\b",
    r"\bwhat if i\b", r"\bwere i to\b", r"\bshould i ever\b",
    r"\bin case i\b", r"\bif i'?m\b", r"\bsuppose i\b",
)

_PRESENT_NOW = (
    r"\bright now\b", r"\bcurrently\b", r"\bat the moment\b",
    r"\bsince (this morning|last night|today|yesterday|a few (minutes|hours))\b",
    r"\bfor the (last|past) (few )?(minutes|hour|hours)\b",
    r"\bstarting (now|today|this morning)\b",
)

# Activity markers — the user (or someone present) is experiencing it now. Includes
# third-party emergencies ("my dad is having a stroke") because those still warrant 911.
_ACTIVE_MARKERS = (
    r"\bi('?m| am)\b", r"\bi feel\b", r"\bi'?ve been\b", r"\bi have\b",
    r"\bi'?m having\b", r"\bi can'?t\b", r"\bi cannot\b", r"\bi think i\b",
    r"\bi want\b", r"\bi'?m going to\b", r"\bhelp me\b",
    r"\bmy (chest|throat|head|arm|heart|breathing)\b",
    r"\bis having a (heart attack|stroke|seizure)\b",
    r"\b(is|are|'?s) (unconscious|unresponsive|not breathing|choking)\b",
    r"\b(is|are|'?s) bleeding (out|badly|heavily|a lot)\b",
    r"\b(he|she|they|someone|my \w+) (is|are|'?s|just) (collapsed|collapsing|"
    r"having|bleeding|choking|seizing|unconscious)\b",
) + _PRESENT_NOW


# --------------------------------------------------------------------------- #
# Result
# --------------------------------------------------------------------------- #

@dataclass
class GuardResult:
    triggered: bool
    category: RiskCategory = RiskCategory.NONE
    confidence: str = NONE
    reply: str | None = None
    tier: str = "rules"
    signals: tuple[str, ...] = field(default_factory=tuple)

    # Backward-compatible aliases for the original guard surface.
    @property
    def is_emergency(self) -> bool:
        return self.triggered

    @property
    def canned_reply(self) -> str | None:
        return self.reply


def _clean(text: str) -> str:
    t = text.lower().replace("’", "'").replace("`", "'")
    t = re.sub(r"\s+", " ", t).strip()
    for idiom in _SAFE_IDIOMS:
        t = re.sub(idiom, " ", t)
    return t


def _any(patterns: tuple[str, ...], text: str) -> bool:
    return any(re.search(p, text) for p in patterns)


def _labels(table: tuple[tuple[str, str], ...], text: str) -> list[str]:
    return [label for label, pat in table if re.search(pat, text)]


def _medical_negated(text: str, matched: list[str]) -> bool:
    """True if a negator sits shortly before any matched medical symptom."""
    pat_by_label = {label: pat for label, pat in MEDICAL_SIGNALS}
    for label in matched:
        symptom = pat_by_label[label]
        for neg in _MEDICAL_NEGATORS:
            if re.search(neg + r"[^.?!]{0,15}(" + symptom + ")", text):
                return True
    return False


def _historical(text: str) -> bool:
    return _any(_HISTORICAL, text)


def _educational(text: str) -> bool:
    """Educational / hypothetical framing: a general question or an 'if I...' clause.

    Present-tense markers ('right now', 'since this morning') always win, so a live
    emergency phrased as a question ("I'm having chest pain, what do I do?") is never
    treated as merely educational.
    """
    if _any(_PRESENT_NOW, text):
        return False
    return _any(_INFORMATIONAL, text) or _any(_HYPOTHETICAL_FIRST_PERSON, text)


def _active(text: str) -> bool:
    return _any(_ACTIVE_MARKERS, text)


def _make(category: RiskCategory, confidence: str, signals: list[str]) -> GuardResult:
    return GuardResult(
        triggered=(confidence == HIGH),
        category=category,
        confidence=confidence,
        reply=REPLY_FOR[category] if confidence in (HIGH, MEDIUM) else None,
        tier="rules",
        signals=tuple(signals),
    )


def detect(text: str) -> GuardResult:
    """Deterministic Tier-1 detection. No network I/O.

    Returns HIGH (route now), MEDIUM (ambiguous — caller should consult the LLM
    adjudicator), or NONE (no routing).
    """
    if not text or not text.strip():
        return GuardResult(triggered=False)
    t = _clean(text)

    active = _active(t)
    educational = _educational(t)
    historical = _historical(t)

    # ---- Self-harm crisis (checked first; its reply also covers 911) ----
    sh = _labels(SELF_HARM_SIGNALS, t)
    if sh:
        if _any(_SELF_HARM_REASSURE, t):
            pass  # explicit denial / reassurance — not a live crisis
        else:
            strong = any(s in STRONG_SELF_HARM for s in sh)
            if educational and not strong:
                pass  # general question or hypothetical about self-harm
            elif strong:
                # Past attempt/ideation -> hand to the LLM tier rather than lock.
                conf = MEDIUM if historical else HIGH
                return _make(RiskCategory.SELF_HARM_CRISIS, conf, sh)
            elif historical:
                return _make(RiskCategory.SELF_HARM_CRISIS, MEDIUM, sh)
            elif active and any(s not in WEAK_SELF_HARM for s in sh):
                return _make(RiskCategory.SELF_HARM_CRISIS, HIGH, sh)
            else:
                return _make(RiskCategory.SELF_HARM_CRISIS, MEDIUM, sh)

    # ---- Medical emergency ----
    med = _labels(MEDICAL_SIGNALS, t)
    if med:
        if _medical_negated(t, med):
            return GuardResult(triggered=False)
        strong = any(m in STRONG_MEDICAL for m in med)
        if educational and not strong:
            return GuardResult(triggered=False)
        if strong:
            # A resolved past event is not an active emergency.
            return (
                GuardResult(triggered=False)
                if historical
                else _make(RiskCategory.MEDICAL_EMERGENCY, HIGH, med)
            )
        if historical:
            return GuardResult(triggered=False)
        if active:
            return _make(RiskCategory.MEDICAL_EMERGENCY, HIGH, med)
        return _make(RiskCategory.MEDICAL_EMERGENCY, MEDIUM, med)

    return GuardResult(triggered=False)
