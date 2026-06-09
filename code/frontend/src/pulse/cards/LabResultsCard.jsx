/**
 * AI-USAGE SUMMARY
 * Tools: Opus 4.7
 * Overall AI Contribution: ~70%
 * AI-Assisted Areas: Drafted the dual-mode renderer (list vs detail), the abnormal-flag pill styling, and the simple reference-range visual marker.
 * Human Contributions: Designed the analyte row (component name, value, unit, reference range, flag pill) to mirror the LabResultDetail page so the inline card feels like a first-class view rather than a chat preview; the "Open full result" link is the only navigation primitive — there's no in-card editing because the card is a read-only patient surface.
 */
import {
  FlaskConical,
  ExternalLink,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtLong(iso) {
  if (!iso) return "–";
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

const FLAG_LABEL = {
  high: "High",
  low: "Low",
  critical_high: "Critical",
  critical_low: "Critical",
  abnormal_high: "High",
  abnormal_low: "Low",
};

function FlagPill({ flag }) {
  const f = (flag || "normal").toLowerCase();
  if (f === "normal") return null;
  const tone =
    f === "high" || f === "critical_high" || f === "abnormal_high"
      ? "high"
      : f === "low" || f === "critical_low" || f === "abnormal_low"
      ? "low"
      : "abn";
  const label = FLAG_LABEL[f] || flag.replace(/_/g, " ");
  return (
    <span className={`pulse-lab-flag pulse-lab-flag--${tone}`}>
      <AlertTriangle size={10} />
      {label}
    </span>
  );
}

function DetailView({ result, onNavigate }) {
  return (
    <div className="pulse-card pulse-card--labs">
      <div className="pulse-card-head">
        <span className="pulse-card-eyebrow">
          <FlaskConical size={12} /> Lab result
        </span>
        <button
          type="button"
          className="pulse-card-link"
          onClick={() => onNavigate?.("labs", { labResultId: result.id })}
        >
          Open full result <ExternalLink size={11} />
        </button>
      </div>
      <p className="pulse-card-title">{result.lab_name || "Lab result"}</p>
      <p className="pulse-card-sub">
        Resulted {fmtLong(result.resulted_at)} · Released {fmtLong(result.released_at)}
        {result.flagged_count > 0 && (
          <span className="pulse-lab-flagged-meta">
            · {result.flagged_count} flagged
          </span>
        )}
      </p>

      {result.entries?.length > 0 && (
        <div className="pulse-lab-table">
          <div className="pulse-lab-row pulse-lab-row--head">
            <span>Component</span>
            <span>Value</span>
            <span>Reference</span>
            <span className="pulse-lab-flag-slot" />
          </div>
          {result.entries.map((e) => (
            <div key={e.id} className="pulse-lab-row">
              <span className="pulse-lab-comp">{e.component_name}</span>
              <span className="pulse-lab-val">
                {e.value ?? e.value_numeric ?? "–"}
                {e.unit && <span className="pulse-lab-unit"> {e.unit}</span>}
              </span>
              <span className="pulse-lab-ref">{e.reference_range || "–"}</span>
              <span className="pulse-lab-flag-slot">
                <FlagPill flag={e.abnormal_flag} />
              </span>
            </div>
          ))}
        </div>
      )}

      {result.notes && (
        <p className="pulse-lab-notes">{result.notes}</p>
      )}
    </div>
  );
}

function ListView({ results, onNavigate }) {
  return (
    <div className="pulse-card pulse-card--labs">
      <div className="pulse-card-head">
        <span className="pulse-card-eyebrow">
          <FlaskConical size={12} /> Lab results
        </span>
        <button
          type="button"
          className="pulse-card-link"
          onClick={() => onNavigate?.("labs")}
        >
          See all <ExternalLink size={11} />
        </button>
      </div>
      <p className="pulse-card-title">Released to you</p>

      {results.length === 0 ? (
        <p className="pulse-card-empty">No released lab results yet.</p>
      ) : (
        <ul className="pulse-lab-list">
          {results.map((r) => (
            <li
              key={r.id}
              className="pulse-lab-item"
              onClick={() => onNavigate?.("labs", { labResultId: r.id })}
            >
              <div className="pulse-lab-item-info">
                <p className="pulse-lab-item-name">{r.lab_name || "Lab result"}</p>
                <p className="pulse-lab-item-meta">
                  Resulted {fmtLong(r.resulted_at)}
                </p>
              </div>
              <ChevronRight size={14} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function LabResultsCard({ payload, onNavigate }) {
  const op = payload?.op || "list";
  const results = payload?.results || [];
  if (op === "detail") {
    const r = results[0];
    if (!r) {
      return (
        <div className="pulse-card pulse-card--labs">
          <p className="pulse-card-empty">That lab result isn't available.</p>
        </div>
      );
    }
    return <DetailView result={r} onNavigate={onNavigate} />;
  }
  return <ListView results={results} onNavigate={onNavigate} />;
}
