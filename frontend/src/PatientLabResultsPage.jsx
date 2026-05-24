import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, FlaskConical } from "lucide-react";
import { labResultsApi } from "./lib/labResultsApi";
import "./labResults.css";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatDateParts(iso) {
  if (!iso) return { month: "—", day: "—", full: "Date pending" };
  const d = new Date(iso);
  return {
    month: MONTHS[d.getMonth()],
    day: d.getDate(),
    full: d.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
  };
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

  return (
    <div className='lab-page'>
      <button className='lab-back-link' onClick={onBack}>
        <ChevronLeft size={14} /> Back to dashboard
      </button>

      <div className='lab-header'>
        <div>
          <h1 className='lab-header-title'>Lab Results</h1>
          <p className='lab-header-subtitle'>
            Released results from your care team
          </p>
        </div>
      </div>

      {error && <div className='lab-banner lab-banner-danger'>{error}</div>}

      <div className='lab-card'>
        {loading ? (
          <div className='lab-empty'>
            <span className='lab-spinner' />
          </div>
        ) : items.length === 0 ? (
          <div className='lab-empty'>
            <p className='lab-empty-title'>No results yet</p>
            <p>
              When your provider releases lab results, they'll appear here.
            </p>
          </div>
        ) : (
          items.map((row) => {
            const dt = formatDateParts(row.resulted_at || row.released_at);
            return (
              <div
                key={row.id}
                className='lab-row'
                onClick={() => onOpenDetail(row.id)}>
                <div className='lab-row-date'>
                  <span className='lab-row-date-month'>{dt.month}</span>
                  <span className='lab-row-date-day'>{dt.day}</span>
                </div>
                <div className='lab-row-divider' />
                <div className='lab-row-info'>
                  <p className='lab-row-title'>{row.lab_name}</p>
                  <p className='lab-row-meta'>
                    <span>{dt.full}</span>
                    <span className='lab-row-meta-sep'>
                      Released to you
                    </span>
                  </p>
                </div>
                <div className='lab-row-actions'>
                  <FlaskConical size={16} color='#9c9c9b' />
                  <ChevronRight size={16} className='lab-row-chevron' />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
