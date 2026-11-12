// AI-USAGE SUMMARY
// Tools: Claude Code (Opus 4.8)
// Overall AI Contribution: ~85%
// AI-Assisted Areas: The week-view slot action menu (#SCRUM-77) — contextual
//   Book / Add availability / Mark unavailable / Make available actions for a
//   clicked slot (week cells are too narrow for inline hover buttons).
// Human Contributions: The contextual action set + verification.
// Notes: Validated via `npm run build`, jest, and manual testing.
import { X, Plus, Check, Ban } from "lucide-react";
import { formatApptTime } from "../lib/appointmentsApi";

function fmtDate(d) {
  return new Date(`${d}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export default function SlotActionsModal({
  date,
  time,
  slotState, // "empty" | "open" | "blocked"
  onBook,
  onOpen,
  onBlock,
  onClose,
}) {
  return (
    <div
      className="sm-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="sm-modal sm-modal--narrow">
        <div className="sm-head">
          <h2 className="sm-title">{formatApptTime(time)}</h2>
          <button className="sm-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <p className="sm-hint">{fmtDate(date)}</p>

        <div className="sm-actions">
          {slotState === "blocked" ? (
            <button className="sm-action-btn" onClick={onOpen}>
              <Check size={15} /> Make available
            </button>
          ) : (
            <>
              <button
                className="sm-action-btn sm-action-btn--primary"
                onClick={onBook}
              >
                <Plus size={15} /> Book appointment
              </button>
              {slotState === "open" && (
                <button
                  className="sm-action-btn sm-action-btn--danger"
                  onClick={onBlock}
                >
                  <Ban size={15} /> Mark unavailable
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
