// AI-USAGE SUMMARY
// Tools: Claude Code (Opus 4.8)
// Overall AI Contribution: ~85%
// AI-Assisted Areas: Modal wrapper around the shared AppointmentForm
//   (#SCRUM-77) for provider-initiated booking.
// Human Contributions: Verification.
// Notes: Validated via `npm run build`, jest, and manual testing.
import { X } from "lucide-react";
import AppointmentForm from "./AppointmentForm";

export default function ScheduleAppointmentModal({
  patients,
  defaultDate = "",
  defaultTime = "09:00",
  onClose,
  onSaved,
}) {
  return (
    <div
      className="sm-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="sm-modal">
        <div className="sm-head">
          <h2 className="sm-title">Add Appointment</h2>
          <button className="sm-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <AppointmentForm
          patients={patients}
          defaultDate={defaultDate}
          defaultTime={defaultTime}
          onSaved={onSaved}
        />
      </div>
    </div>
  );
}
