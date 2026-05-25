/**
 * AI-USAGE SUMMARY
 * Tools: Opus 4.7
 * Overall AI Contribution: ~75%
 * AI-Assisted Areas: Generated the grouped-card listing using the shared lab-group / lab-row pattern, the abnormal-count derivation, the long-date formatter, and the empty-state copy.
 * Human Contributions: Patient-facing copy ("Released results from your care team", empty-state messaging), and the click-through wiring to the detail screen.
 */
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, FlaskConical } from "lucide-react";
import { labResultsApi } from "./lib/labResultsApi";
import "./labResults.css";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatLongDate(iso) {
  if (!iso) return "Pending";
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function flaggedCount(row) {
  if (typeof row.flagged_count === "number") return row.flagged_count;
  if (!row.entries) return 0;
  return row.entries.filter(
    (e) => e.abnormal_flag && e.abnormal_flag !== "normal"
  ).length;
}

export default function PatientLabResultsPage({ onBack, onOpenDetail }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    labResultsApi
      .list({ limit: 100 })
      .then((rows) => {
        if (!alive) return;
        setItems(rows || []);
        setLoading(false);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e.message);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const totalFlags = useMemo(
    () => items.reduce((sum, r) => sum + flaggedCount(r), 0),
    [items]
  );

  return (
    <div className='lab-page'>
      <button className='lab-back-link' onClick={onBack}>
        <ChevronLeft size={14} /> Back to dashboard
      </button>

      <div className='lab-eyebrow'>Your health</div>
      <div className='lab-header'>
        <div>
          <h1 className='lab-header-title'>Lab Results</h1>
          <p className='lab-header-subtitle'>
            {items.length === 0
              ? "Released results from your care team will appear here"
              : `${items.length} ${items.length === 1 ? "result" : "results"} released by your care team${
                  totalFlags > 0 ? ` · ${totalFlags} flagged values to discuss` : ""
                }`}
          </p>
        </div>
      </div>

      <div style={{ height: 24 }} />

      {error && <div className='lab-banner lab-banner-danger'>{error}</div>}

      <div className='lab-group'>
        <div className='lab-group-header'>
          <div>
            <h3 className='lab-group-title'>Released to you</h3>
            <p className='lab-group-sub'>
              Released and reviewed by your provider
            </p>
          </div>
          {items.length > 0 && (
            <span className='lab-group-meta'>
              {items.length} {items.length === 1 ? "file" : "files"}
            </span>
          )}
        </div>
        <div className='lab-group-body'>
          {loading ? (
            <div className='lab-group-empty'>
              <span className='lab-spinner' />
            </div>
          ) : items.length === 0 ? (
            <div className='lab-group-empty'>
              <p className='lab-empty-title'>No results yet</p>
              <p>
                When your provider releases lab results, they'll appear here.
              </p>
            </div>
          ) : (
            items.map((row) => {
              const flags = flaggedCount(row);
              return (
                <div
                  key={row.id}
                  className='lab-row'
                  onClick={() => onOpenDetail(row.id)}>
                  <div className='lab-row-icon released'>
                    <FlaskConical size={18} />
                  </div>
                  <div className='lab-row-info'>
                    <p className='lab-row-title'>
                      {row.lab_name || "Lab result"}
                      {flags > 0 && (
                        <span className='lab-flagged-badge'>
                          {flags} flagged
                        </span>
                      )}
                    </p>
                    <p className='lab-row-meta'>
                      <span>
                        Resulted {formatLongDate(row.resulted_at)}
                      </span>
                      <span className='lab-row-meta-sep'>
                        Released {formatLongDate(row.released_at)}
                      </span>
                    </p>
                  </div>
                  <div className='lab-row-actions'>
                    <button
                      className='lab-btn'
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenDetail(row.id);
                      }}>
                      View results
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
