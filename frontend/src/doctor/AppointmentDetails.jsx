// AI-USAGE SUMMARY
// Tools: Claude Code (Opus 4.8)
// Overall AI Contribution: ~85%
// AI-Assisted Areas: The compact provider appointment-details card (#SCRUM-77) —
//   patient, date, time, status, and notes with Message / Cancel actions. Used
//   by the details modal (week view + dashboard popups); the day-view side panel
//   now uses the dedicated AppointmentPanel instead.
// Human Contributions: Layout choices and verification.
// Notes: Validated via `npm run build` and jest.
import { Calendar, Clock, User, FileText, MessageSquare, X } from "lucide-react";
import { formatApptTime } from "../lib/appointmentsApi";

function fmtDate(d) {
  return d
    ? new Date(`${d}T12:00:00`).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : "";
}

export default function AppointmentDetails({
  appt,
  onCancel,
  onMessage,
  wide = false,
}) {
  if (!appt) return null;
  return (
    <div className={`ad-card${wide ? " ad-card--wide" : ""}`}>
      <div className="ad-info">
        <div className="ad-avatar">
          <User size={22} />
        </div>
        <div className="ad-info-text">
          <p className="ad-name">{appt.patient_name || "Patient"}</p>
          <span className={`ad-status ds-status--${appt.status}`}>
            {appt.status}
          </span>

          <div className="ad-rows">
            <p className="ad-row">
              <Calendar size={14} /> {fmtDate(appt.available_date)}
            </p>
            <p className="ad-row">
              <Clock size={14} /> {formatApptTime(appt.available_time)}
            </p>
            {appt.notes && (
              <p className="ad-row">
                <FileText size={14} /> {appt.notes}
              </p>
            )}
          </div>
        </div>
      </div>

      {(onMessage || onCancel) && (
        <div className="ad-actions">
          {onMessage && (
            <button className="ad-btn" onClick={() => onMessage(appt)}>
              <MessageSquare size={14} /> Message
            </button>
          )}
          {onCancel && (
            <button
              className="ad-btn ad-btn--danger"
              onClick={() => onCancel(appt)}
            >
              <X size={14} /> Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
}
