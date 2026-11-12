// AI-USAGE SUMMARY
// Tools: Claude Code (Opus 4.8)
// Overall AI Contribution: ~85%
// AI-Assisted Areas: The shared provider Add-Appointment form (#SCRUM-77) —
//   patient picker + date/time + notes, posting to /schedule/appointments.
//   Reused by the Add-Appointment modal and the Day-view side panel.
// Human Contributions: Field/validation choices and verification.
// Notes: Validated via `npm run build`, jest, and manual testing.
import { useState } from "react";
import { Plus } from "lucide-react";
import { schedulingApi } from "../lib/schedulingApi";

function patientName(p) {
  return `${p.first_name} ${p.last_name}`.trim();
}

export default function AppointmentForm({
  patients,
  defaultDate = "",
  defaultTime = "09:00",
  onSaved,
}) {
  const [patientId, setPatientId] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState(defaultTime);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  if (patients.length === 0) {
    return (
      <p className="sm-hint">
        You have no patients yet. Patients appear here once they book with you.
      </p>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!patientId || !date || !time)
      return setError("Choose a patient, date, and time.");
    setSaving(true);
    try {
      await schedulingApi.createAppointment({
        patient_id: patientId,
        date,
        time,
        notes: notes || null,
      });
      onSaved?.();
    } catch (err) {
      setError(err.message || "Could not create appointment.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="sm-body" onSubmit={submit}>
      <label className="sm-label">Patient</label>
      <select
        className="sm-input"
        value={patientId}
        onChange={(e) => setPatientId(e.target.value)}
      >
        <option value="">Select a patient…</option>
        {patients.map((p) => (
          <option key={p.id} value={p.id}>
            {patientName(p)}
          </option>
        ))}
      </select>

      <div className="sm-row">
        <div>
          <label className="sm-label">Date</label>
          <input
            type="date"
            className="sm-input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div>
          <label className="sm-label">Time</label>
          <input
            type="time"
            step="1800"
            className="sm-input"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>
      </div>

      <label className="sm-label">Notes (optional)</label>
      <textarea
        className="sm-input sm-textarea"
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      {error && <p className="sm-error">{error}</p>}
      <button className="sm-submit" disabled={saving}>
        <Plus size={15} /> {saving ? "Booking…" : "Add Appointment"}
      </button>
    </form>
  );
}
