// AI-USAGE SUMMARY
// Tools: Claude Code (Opus 4.8)
// Overall AI Contribution: ~85%
// AI-Assisted Areas: The shared appointment details panel (#SCRUM-77) — avatar
//   with the name beneath it, the date and time stacked in the top-right, the
//   details as the focal middle content, and full-width Message / Reschedule /
//   Cancel buttons at the bottom. Used by the provider day-view (patient as the
//   name, fills the column) and the patient details modal (provider name +
//   specialty as name/subtitle, shorter), so it carries its own portable CSS.
// Human Contributions: Iterated the layout and the reuse; verification.
// Notes: Validated via `npm run build`, jest, and manual testing.
import {
  Calendar,
  Clock,
  User,
  FileText,
  MessageSquare,
  RefreshCw,
  X,
} from "lucide-react";
import { formatApptTime } from "../lib/appointmentsApi";
import "./AppointmentPanel.css";

function fmtDate(d) {
  return d
    ? new Date(`${d}T12:00:00`).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : "";
}

export default function AppointmentPanel({
  appt,
  onCancel,
  onMessage,
  onReschedule,
  name,
  subtitle,
  fill = true,
}) {
  if (!appt) return null;
  return (
    <div className={`apanel${fill ? " apanel--fill" : ""}`}>
      <div className="apanel-head">
        <div className="apanel-head-left">
          <div className="apanel-avatar">
            <User size={26} />
          </div>
          <p className="apanel-name">{name ?? appt.patient_name ?? "Patient"}</p>
          {subtitle && <p className="apanel-subtitle">{subtitle}</p>}
          <span className={`apanel-status apanel-status--${appt.status}`}>
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

      {(onMessage || onReschedule || onCancel) && (
        <div className="apanel-actions">
          {onMessage && (
            <button className="apanel-btn" onClick={() => onMessage(appt)}>
              <MessageSquare size={15} /> Message
            </button>
          )}
          {onReschedule && (
            <button className="apanel-btn" onClick={() => onReschedule(appt)}>
              <RefreshCw size={15} /> Reschedule
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
