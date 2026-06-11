// AI-USAGE SUMMARY
// Tools: Claude Code (Opus 4.8)
// Overall AI Contribution: ~85%
// AI-Assisted Areas: The shared appointment-details card (#SCRUM-77) — avatar,
//   name/subtitle, status, date, time, and notes with optional Message /
//   Reschedule / Cancel actions. Used by the provider details modal (patient as
//   the headline) and the patient details modal (provider name + specialty as
//   name/subtitle), so it carries its own portable stylesheet.
// Human Contributions: Reuse direction and verification.
// Notes: Validated via `npm run build` and jest.
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
import "./AppointmentDetails.css";

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
  onReschedule,
  wide = false,
  name,
  subtitle,
}) {
  if (!appt) return null;
  return (
    <div className={`ad-card${wide ? " ad-card--wide" : ""}`}>
      <div className="ad-info">
        <div className="ad-avatar">
          <User size={22} />
        </div>
        <div className="ad-info-text">
          <p className="ad-name">{name ?? appt.patient_name ?? "Patient"}</p>
          {subtitle && <p className="ad-subtitle">{subtitle}</p>}
          <span className={`ad-status ad-status--${appt.status}`}>
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

      {(onMessage || onReschedule || onCancel) && (
        <div className="ad-actions">
          {onMessage && (
            <button className="ad-btn" onClick={() => onMessage(appt)}>
              <MessageSquare size={14} /> Message
            </button>
          )}
          {onReschedule && (
            <button className="ad-btn" onClick={() => onReschedule(appt)}>
              <RefreshCw size={14} /> Reschedule
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
