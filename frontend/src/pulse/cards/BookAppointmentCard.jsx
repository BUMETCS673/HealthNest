/**
 * AI-USAGE SUMMARY
 * Model: Claude Opus 4.8
 * Overall AI Contribution: ~70%
 * AI-Assisted Areas: Drafted the stage-driven render (confirm / alternatives / choose_time / choose_provider / none) and the local booking state machine (browse → confirming → booking → booked/error).
 * Human Contributions: Decided the card owns the write — selecting an option then confirming calls the proven appointmentsApi.createAppointment directly, so booking is deterministic and never round-trips back through the LLM. Each option carries provider_id + availability_id from the skill, so the card books with no extra fetch; a 409 (slot taken meanwhile) surfaces as an inline retry instead of a dead end.
 */
import { useState } from "react";
import {
  CalendarPlus,
  Clock,
  Stethoscope,
  Check,
  ChevronRight,
  AlertCircle,
  CalendarCheck,
} from "lucide-react";
import { appointmentsApi } from "../../lib/appointmentsApi";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function fmtDate(d) {
  if (!d) return "";
  const dt = new Date(d + "T12:00:00");
  return `${MONTHS[dt.getMonth()]} ${dt.getDate()}`;
}

function fmtTime(t) {
  if (!t) return "";
  const [hh, mm] = t.split(":");
  const h = parseInt(hh, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${mm} ${ampm}`;
}

function providerLabel(p) {
  return p?.name || "this provider";
}

/** A single tappable option row (provider + one slot). */
function OptionRow({ option, onPick }) {
  const { provider, slot } = option;
  return (
    <li>
      <button
        type="button"
        className="pulse-book-option"
        onClick={() => onPick(option)}
      >
        <span className="pulse-book-option-main">
          <span className="pulse-book-option-doc">{provider.name}</span>
          {provider.specialty && (
            <span className="pulse-book-option-specialty">
              {provider.specialty}
            </span>
          )}
        </span>
        <span className="pulse-book-option-when">
          {fmtDate(slot.date)} · {fmtTime(slot.time)}
        </span>
        <ChevronRight size={14} className="pulse-book-option-chev" />
      </button>
    </li>
  );
}

/** A tappable time-only row for a known provider. */
function SlotRow({ slot, onPick }) {
  return (
    <li>
      <button
        type="button"
        className="pulse-book-option"
        onClick={() => onPick(slot)}
      >
        <span className="pulse-book-option-when pulse-book-option-when--lead">
          <Clock size={12} /> {fmtDate(slot.date)} · {fmtTime(slot.time)}
        </span>
        <ChevronRight size={14} className="pulse-book-option-chev" />
      </button>
    </li>
  );
}

export default function BookAppointmentCard({ payload, onNavigate }) {
  const stage = payload?.stage;
  const notes = payload?.notes ?? null;

  // Confirm stage opens straight into the confirmation step.
  const initialSelected =
    stage === "confirm" && payload.slot
      ? { provider: payload.provider, slot: payload.slot }
      : null;

  const [phase, setPhase] = useState(
    initialSelected ? "confirming" : "browse",
  );
  const [selected, setSelected] = useState(initialSelected);
  const [errorMsg, setErrorMsg] = useState("");

  const pickOption = (option) => {
    setSelected(option);
    setPhase("confirming");
  };

  const pickSlot = (slot) => {
    setSelected({ provider: payload.provider, slot });
    setPhase("confirming");
  };

  const confirm = async () => {
    if (!selected) return;
    setPhase("booking");
    setErrorMsg("");
    try {
      await appointmentsApi.createAppointment({
        provider_id: selected.provider.id,
        availability_id: selected.slot.availability_id,
        notes,
      });
      setPhase("booked");
    } catch (err) {
      setErrorMsg(err?.message || "Could not book this appointment.");
      setPhase("error");
    }
  };

  const back = () => {
    if (stage === "confirm") return; // nothing to go back to
    setSelected(null);
    setErrorMsg("");
    setPhase("browse");
  };

  return (
    <div className="pulse-card pulse-card--book">
      <div className="pulse-card-head">
        <span className="pulse-card-eyebrow">
          <CalendarPlus size={12} /> Book appointment
        </span>
      </div>

      {phase === "booked" && (
        <div className="pulse-book-done">
          <div className="pulse-book-done-icon">
            <CalendarCheck size={18} />
          </div>
          <p className="pulse-card-title">Appointment booked</p>
          <p className="pulse-book-done-sub">
            {providerLabel(selected?.provider)} on {fmtDate(selected?.slot?.date)}{" "}
            at {fmtTime(selected?.slot?.time)}.
          </p>
          <button
            type="button"
            className="pulse-book-confirm"
            onClick={() => onNavigate?.("appointments")}
          >
            View my appointments
          </button>
        </div>
      )}

      {(phase === "confirming" || phase === "booking" || phase === "error") && (
        <div className="pulse-book-confirm-panel">
          <p className="pulse-card-title">Confirm this appointment</p>
          <div className="pulse-book-summary">
            <p className="pulse-book-summary-doc">
              {providerLabel(selected?.provider)}
              {selected?.provider?.specialty && (
                <span className="pulse-book-option-specialty">
                  {selected.provider.specialty}
                </span>
              )}
            </p>
            <p className="pulse-book-summary-when">
              <Stethoscope size={12} /> {fmtDate(selected?.slot?.date)} ·{" "}
              {fmtTime(selected?.slot?.time)}
            </p>
            {notes && <p className="pulse-book-summary-notes">“{notes}”</p>}
          </div>

          {phase === "error" && (
            <p className="pulse-book-error" role="alert">
              <AlertCircle size={13} /> {errorMsg}
            </p>
          )}

          <div className="pulse-book-actions">
            <button
              type="button"
              className="pulse-book-confirm"
              onClick={confirm}
              disabled={phase === "booking"}
            >
              {phase === "booking" ? (
                "Booking…"
              ) : phase === "error" ? (
                "Try again"
              ) : (
                <>
                  <Check size={14} /> Confirm
                </>
              )}
            </button>
            {stage !== "confirm" && (
              <button
                type="button"
                className="pulse-book-back"
                onClick={back}
                disabled={phase === "booking"}
              >
                Back
              </button>
            )}
          </div>
        </div>
      )}

      {phase === "browse" && (
        <>
          {stage === "none" && (
            <p className="pulse-card-empty">
              There are no open appointment slots to book right now.
            </p>
          )}

          {stage === "choose_provider" && (
            <>
              <p className="pulse-card-title">Choose a provider</p>
              <ul className="pulse-book-list">
                {(payload.options || []).map((opt) => (
                  <OptionRow
                    key={opt.slot.availability_id}
                    option={opt}
                    onPick={pickOption}
                  />
                ))}
              </ul>
            </>
          )}

          {stage === "choose_time" && (
            <>
              <p className="pulse-card-title">
                Pick a time with {providerLabel(payload.provider)}
              </p>
              <ul className="pulse-book-list">
                {(payload.slots || []).map((slot) => (
                  <SlotRow
                    key={slot.availability_id}
                    slot={slot}
                    onPick={pickSlot}
                  />
                ))}
              </ul>
            </>
          )}

          {stage === "alternatives" && (
            <>
              <p className="pulse-card-title">
                {providerLabel(payload.provider)} isn't free then
              </p>
              {payload.provider_slots?.length > 0 && (
                <div className="pulse-book-section">
                  <p className="pulse-card-sub">
                    Other times with {providerLabel(payload.provider)}
                  </p>
                  <ul className="pulse-book-list">
                    {payload.provider_slots.map((slot) => (
                      <SlotRow
                        key={slot.availability_id}
                        slot={slot}
                        onPick={pickSlot}
                      />
                    ))}
                  </ul>
                </div>
              )}
              {payload.other_providers?.length > 0 && (
                <div className="pulse-book-section">
                  <p className="pulse-card-sub">
                    Other providers at {fmtTime(payload.requested?.time)}
                  </p>
                  <ul className="pulse-book-list">
                    {payload.other_providers.map((opt) => (
                      <OptionRow
                        key={opt.slot.availability_id}
                        option={opt}
                        onPick={pickOption}
                      />
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
