// AI-USAGE SUMMARY
// Tools: Claude Code (Opus 4.8)
// Overall AI Contribution: ~85%
// AI-Assisted Areas: The day-view appointment details panel (#SCRUM-77) — a tall
//   card that fills the right side: avatar with the patient name beneath it,
//   the date and time stacked in the top-right, the appointment details as the
//   focal middle content, and full-width Message / Cancel buttons at the bottom.
// Human Contributions: Iterated the layout (name under avatar, date+time moved
//   to the top-right, full-width actions) and verification.
// Notes: Validated via `npm run build`, jest, and manual testing.
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

export default function AppointmentPanel({ appt, onCancel, onMessage }) {
  if (!appt) return null;
  return (
    <div className="apanel">
      <div className="apanel-head">
        <div className="apanel-head-left">
          <div className="apanel-avatar">
            <User size={26} />
          </div>
          <p className="apanel-name">{appt.patient_name || "Patient"}</p>
          <span className={`apanel-status ds-status--${appt.status}`}>
            {appt.status}
          </span>
        </div>
        <div className="apanel-when">
          <span className="apanel-when-row">
            <Calendar size={15} /> {fmtDate(appt.available_date)}
          </span>
          <span className="apanel-when-row">
            <Clock size={15} /> {formatApptTime(appt.available_time)}
          </span>
        </div>
      </div>

      <div className="apanel-body">
        {appt.notes && (
          <p className="apanel-detail">
            <FileText size={16} /> {appt.notes}
          </p>
        )}
      </div>

      {(onMessage || onCancel) && (
        <div className="apanel-actions">
          {onMessage && (
            <button className="apanel-btn" onClick={() => onMessage(appt)}>
              <MessageSquare size={15} /> Message
            </button>
          )}
          {onCancel && (
            <button
              className="apanel-btn apanel-btn--danger"
              onClick={() => onCancel(appt)}
            >
              <X size={15} /> Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
}
