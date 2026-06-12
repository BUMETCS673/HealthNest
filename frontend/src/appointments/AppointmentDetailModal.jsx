// AI-USAGE SUMMARY
// Tools: Claude Code (Opus 4.8)
// Overall AI Contribution: ~85%
// AI-Assisted Areas: Patient-side appointment-details modal. Reuses the shared
//   AppointmentPanel from the provider day view (avatar + name/subtitle/status,
//   date/time top-right) and renders a matching full-width action footer
//   (Message / Reschedule / Cancel) with an in-modal cancel confirmation, so the
//   Appointments page and the Dashboard show an identical popup.
// Human Contributions: Requested the provider-panel look, the messaging button,
//   the click-to-details behavior, and that both popups match; verification.
// Notes: Validated via `npm run build`, jest, and manual testing.
import { useState } from "react";
import { MessageSquare, RefreshCw, X } from "lucide-react";
import AppointmentPanel from "../doctor/AppointmentPanel";
import "./AppointmentDetailModal.css";

// Map a patient display-row (apptToDisplayRow) onto the shape AppointmentPanel
// expects (it was written for the provider's appointment shape).
function toDetailsAppt(row) {
  return {
    status: row.status,
    available_date: row.raw?.provider_availability?.available_date,
    available_time: row.raw?.provider_availability?.available_time,
    notes: row.notes,
  };
}

export default function AppointmentDetailModal({
  appt,
  onClose,
  onMessage,
  onReschedule,
  onCancel,
}) {
  const [confirming, setConfirming] = useState(false);
  if (!appt) return null;

  const hasActions = onMessage || onReschedule || onCancel;

  return (
    <div
      className="adm-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="adm-box">
        <div className="adm-head">
          <button className="adm-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <AppointmentPanel
          appt={toDetailsAppt(appt)}
          name={appt.doctor}
          subtitle={appt.specialty}
          fill={false}
        />

        {hasActions &&
          (confirming ? (
            <div className="adm-confirm">
              <p className="adm-confirm-text">Cancel this appointment?</p>
              <div className="apanel-actions">
                <button
                  className="apanel-btn"
                  onClick={() => setConfirming(false)}
                >
                  Keep
                </button>
                <button
                  className="apanel-btn apanel-btn--danger"
                  onClick={() => onCancel(appt)}
                >
                  <X size={15} /> Yes, cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="apanel-actions adm-actions">
              {onMessage && (
                <button className="apanel-btn" onClick={() => onMessage(appt)}>
                  <MessageSquare size={15} /> Message
                </button>
              )}
              {onReschedule && (
                <button
                  className="apanel-btn"
                  onClick={() => onReschedule(appt)}
                >
                  <RefreshCw size={15} /> Reschedule
                </button>
              )}
              {onCancel && (
                <button
                  className="apanel-btn apanel-btn--danger"
                  onClick={() => setConfirming(true)}
                >
                  <X size={15} /> Cancel
                </button>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
