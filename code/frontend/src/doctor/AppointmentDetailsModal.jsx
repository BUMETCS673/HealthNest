// AI-USAGE SUMMARY
// Tools: Claude Code (Opus 4.8)
// Overall AI Contribution: ~85%
// AI-Assisted Areas: Modal wrapper around AppointmentDetails (#SCRUM-77), used by
//   the Week view and the dashboard card; forwards cancel/message actions.
// Human Contributions: Verification.
// Notes: Validated via `npm run build` and jest.
import { X } from "lucide-react";
import AppointmentDetails from "./AppointmentDetails";

export default function AppointmentDetailsModal({
  appt,
  onClose,
  onCancel,
  onMessage,
}) {
  return (
    <div
      className="sm-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="sm-modal">
        <div className="sm-head">
          <h2 className="sm-title">Appointment</h2>
          <button className="sm-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <AppointmentDetails
          appt={appt}
          onCancel={onCancel}
          onMessage={onMessage}
        />
      </div>
    </div>
  );
}
