/**
 * AI-USAGE SUMMARY
 * Tools: Opus 4.7
 * Overall AI Contribution: ~60%
 * AI-Assisted Areas: Drafted the date-pill / row layout that visually matches the existing PatientDashboard upcoming-appointments tile.
 * Human Contributions: Tied the "Open in Appointments" button into the dashboard onNavigate('appointments') hook so the card never owns its own fetcher; empty-state copy is patient-facing, not engineer-facing.
 */
import { Calendar, Stethoscope, ExternalLink } from "lucide-react";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function fmtDate(d) {
  if (!d) return { m: "–", n: "–" };
  const dt = new Date(d + "T12:00:00");
  return { m: MONTHS[dt.getMonth()], n: String(dt.getDate()) };
}

function fmtTime(t) {
  if (!t) return "";
  const [hh, mm] = t.split(":");
  const h = parseInt(hh, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${mm} ${ampm}`;
}

export default function AppointmentsCard({ payload, onNavigate }) {
  const appts = payload?.appointments || [];
  const heading =
    payload?.filter === "next"
      ? "Your next appointment"
      : payload?.filter === "past"
        ? "Past appointments"
        : payload?.filter === "on_date"
          ? "Appointments on that date"
          : "Your upcoming appointments";

  return (
    <div className="pulse-card pulse-card--appts">
      <div className="pulse-card-head">
        <span className="pulse-card-eyebrow">
          <Calendar size={12} /> Appointments
        </span>
        <button
          type="button"
          className="pulse-card-link"
          onClick={() => onNavigate?.("appointments")}
        >
          Open <ExternalLink size={11} />
        </button>
      </div>
      <p className="pulse-card-title">{heading}</p>

      {appts.length === 0 ? (
        <p className="pulse-card-empty">No appointments to show.</p>
      ) : (
        <ul className="pulse-appt-list">
          {appts.map((a) => {
            const d = fmtDate(a.appointment_date);
            return (
              <li key={a.id} className="pulse-appt-row">
                <div className="pulse-appt-date">
                  <span className="pulse-appt-month">{d.m}</span>
                  <span className="pulse-appt-day">{d.n}</span>
                </div>
                <div className="pulse-appt-info">
                  <p className="pulse-appt-doc">
                    {a.provider_name}
                    {a.specialty && (
                      <span className="pulse-appt-specialty">
                        · {a.specialty}
                      </span>
                    )}
                  </p>
                  <p className="pulse-appt-meta">
                    <Stethoscope size={11} />
                    <span>{fmtTime(a.appointment_time)}</span>
                  </p>
                </div>
                <span
                  className={`pulse-appt-status pulse-appt-status--${a.status}`}
                >
                  {a.status}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
