import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  Plus,
} from "lucide-react";
import { labResultsApi } from "./lib/labResultsApi";
import { patientsApi, formatPatientName } from "./lib/patientsApi";
import LabResultUploadModal from "./LabResultUploadModal";
import Toast from "./Toast";
import "./labResults.css";

const FILTERS = [
  { value: "", label: "All" },
  { value: "uploaded", label: "Pending review" },
  { value: "reviewed", label: "Ready to release" },
  { value: "released", label: "Released" },
  { value: "archived", label: "Archived" },
];

const STATUS_LABELS = {
  uploaded: "Uploaded",
  reviewed: "Reviewed",
  released: "Released",
  archived: "Archived",
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatDateParts(iso) {
  if (!iso) return { month: "—", day: "—", full: "Pending" };
  const d = new Date(iso);
  return {
    month: MONTHS[d.getMonth()],
    day: d.getDate(),
    full: d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
  };
}

function shortPatient(id) {
  if (!id) return "—";
  return `Patient #${id.slice(0, 8)}`;
}

export default function LabResultsPage({ onBack, onOpenReview }) {
  const [filter, setFilter] = useState("");
  const [items, setItems] = useState([]);
  const [patientsById, setPatientsById] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [toastLeaving, setToastLeaving] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let alive = true;
    labResultsApi
      .list({ statusFilter: filter || undefined, limit: 100 })
      .then(async (rows) => {
        if (!alive) return;
        setItems(rows || []);
        setError(null);
        setLoading(false);
        const ids = Array.from(new Set((rows || []).map((r) => r.patient_id)));
        if (ids.length > 0) {
          const map = await patientsApi.getMany(ids);
          if (alive) setPatientsById((prev) => ({ ...prev, ...map }));
        }
      })
      .catch((e) => {
        if (!alive) return;
        setError(e.message);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [filter, refreshTick]);

  useEffect(() => {
    if (!toast) return undefined;
    setToastLeaving(false);
    const leave = setTimeout(() => setToastLeaving(true), 2400);
    const remove = setTimeout(() => setToast(null), 2600);
    return () => {
      clearTimeout(leave);
      clearTimeout(remove);
    };
  }, [toast]);

  function handleUploaded(detail) {
    setUploadOpen(false);
    setToast({
      variant: "info",
      title: "Upload received",
      detail: `${detail.lab_name} — review pending`,
    });
    setRefreshTick((n) => n + 1);
    onOpenReview(detail.id);
  }

  const pendingCount = items.filter((r) => r.status === "uploaded").length;

  return (
    <div className='lab-page'>
      <button className='lab-back-link' onClick={onBack}>
        <ChevronLeft size={14} /> Back to dashboard
      </button>

      <div className='lab-header'>
        <div>
          <h1 className='lab-header-title'>Lab Results</h1>
          <p className='lab-header-subtitle'>
            {pendingCount > 0
              ? `${pendingCount} pending your review`
              : "All caught up. Upload a new result to begin."}
          </p>
        </div>
        <div className='lab-header-actions'>
          <button
            className='lab-btn lab-btn-primary'
            onClick={() => setUploadOpen(true)}>
            <Plus size={14} /> Upload result
          </button>
        </div>
      </div>

      <div className='lab-filters'>
        {FILTERS.map((f) => (
          <button
            key={f.value || "all"}
            className={`lab-chip ${filter === f.value ? "active" : ""}`}
            onClick={() => setFilter(f.value)}>
            {f.label}
          </button>
        ))}
      </div>

      {error && <div className='lab-banner lab-banner-danger'>{error}</div>}

      <div className='lab-card'>
        {loading ? (
          <div className='lab-empty'>
            <span className='lab-spinner' />
          </div>
        ) : items.length === 0 ? (
          <div className='lab-empty'>
            <p className='lab-empty-title'>
              {filter ? "No matching results" : "No lab results yet"}
            </p>
            <p>
              {filter
                ? "Try a different filter, or upload a new result."
                : "Click \"Upload result\" to ingest an HL7 v2 or FHIR file."}
            </p>
          </div>
        ) : (
          items.map((row) => {
            const dt = formatDateParts(row.resulted_at || row.created_at);
            return (
              <div
                key={row.id}
                className='lab-row'
                onClick={() => onOpenReview(row.id)}>
                <div className='lab-row-date'>
                  <span className='lab-row-date-month'>{dt.month}</span>
                  <span className='lab-row-date-day'>{dt.day}</span>
                </div>
                <div className='lab-row-divider' />
                <div className='lab-row-info'>
                  <p className='lab-row-title'>
                    {patientsById[row.patient_id]
                      ? formatPatientName(patientsById[row.patient_id])
                      : shortPatient(row.patient_id)}
                  </p>
                  <p className='lab-row-meta'>
                    <span>{row.lab_name}</span>
                    <span className='lab-row-meta-sep'>
                      {row.source_format.toUpperCase()}
                    </span>
                    <span className='lab-row-meta-sep'>{dt.full}</span>
                  </p>
                </div>
                <div className='lab-row-actions'>
                  <span className={`lab-status lab-status-${row.status}`}>
                    {STATUS_LABELS[row.status]}
                  </span>
                  <FlaskConical size={16} color='#9c9c9b' />
                  <ChevronRight size={16} className='lab-row-chevron' />
                </div>
              </div>
            );
          })
        )}
      </div>

      {uploadOpen && (
        <LabResultUploadModal
          onClose={() => setUploadOpen(false)}
          onUploaded={handleUploaded}
        />
      )}

      <Toast toast={toast} leaving={toastLeaving} />
    </div>
  );
}
