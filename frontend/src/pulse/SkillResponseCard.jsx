/**
 * AI-USAGE SUMMARY
 * Tools: Opus 4.7
 * Overall AI Contribution: ~55%
 * AI-Assisted Areas: Drafted the skill-name switch and the fallback "unknown skill" renderer.
 * Human Contributions: Picked the dispatch shape (one component per skill name keyed by the backend `skill` string) so adding a new skill card is one import + one branch — keeps Pulse extensible without re-architecting the message renderer.
 */
import AppointmentsCard from "./cards/AppointmentsCard";
import BookAppointmentCard from "./cards/BookAppointmentCard";
import LabResultsCard from "./cards/LabResultsCard";

export default function SkillResponseCard({ skillOutput, onNavigate }) {
  if (!skillOutput?.payload) return null;
  switch (skillOutput.skill) {
    case "get_appointments":
      return (
        <AppointmentsCard
          payload={skillOutput.payload}
          onNavigate={onNavigate}
        />
      );
    case "book_appointment":
      return (
        <BookAppointmentCard
          payload={skillOutput.payload}
          onNavigate={onNavigate}
        />
      );
    case "get_lab_results":
      return (
        <LabResultsCard
          payload={skillOutput.payload}
          onNavigate={onNavigate}
        />
      );
    default:
      return (
        <div className="pulse-card pulse-card--unknown">
          <p className="pulse-card-title">{skillOutput.skill}</p>
          <pre className="pulse-card-raw">
            {JSON.stringify(skillOutput.payload, null, 2)}
          </pre>
        </div>
      );
  }
}
