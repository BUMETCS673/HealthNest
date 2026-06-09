/**
 * AI-USAGE SUMMARY
 * Tools: Opus 4.7
 * Overall AI Contribution: ~70%
 * AI-Assisted Areas: Generated the sub-tab strip with live counts, the inline drop-zone hero (drag/drop + browse), the Pending Review / Released to Patient grouped-card rendering, the flagged-count derivation, and the MRN pill formatter.
 * Human Contributions: Group taxonomy and copy ("Parsed and ready · not yet visible to patient"), the choice to surface Review & Release / View results inline per row instead of via row-click only, and the decision to route directly into the review screen after a successful upload.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  CheckCircle2,
  FlaskConical,
  Upload,
} from "lucide-react";
import { labResultsApi } from "../lib/labResultsApi";
import { patientsApi, formatPatientName } from "../lib/patientsApi";
import LabResultUploadModal from "../labresults/LabResultUploadModal";
import Toast from "./Toast";
import "./labResults.css";

const TABS = [
  { value: "lab-upload", label: "Lab Upload" },
];

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatLongDate(iso) {
  if (!iso) return "Pending";
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function mrn(patient, patientId) {
  const raw = patient?.mrn;
  if (raw) return /^mrn[-\s]/i.test(raw) ? raw : `MRN-${raw}`;
  if (!patientId) return "—";
  return `MRN-${patientId.slice(0, 5).toUpperCase()}`;
}

function flaggedCount(row) {
  if (typeof row.flagged_count === "number") return row.flagged_count;
  if (!row.entries) return 0;
  return row.entries.filter(
    (e) => e.abnormal_flag && e.abnormal_flag !== "normal"
  ).length;
}

function entriesCount(row) {
  if (typeof row.entries_count === "number") return row.entries_count;
  return row.entries?.length ?? 0;
}

export default function LabResultsPage({ onBack, onOpenReview }) {
  const [activeTab, setActiveTab] = useState("lab-upload");
  const [items, setItems] = useState([]);
  const [patientsById, setPatientsById] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [toast, setToastRaw] = useState(null);
  const [toastLeaving, setToastLeaving] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [stagedFile, setStagedFile] = useState(null);
  const fileInputRef = useRef(null);

  function setToast(t) {
    setToastLeaving(false);
    setToastRaw(t);
  }

  useEffect(() => {
    let alive = true;
    labResultsApi
      .list({ limit: 100 })
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
  }, [refreshTick]);

  useEffect(() => {
    if (!toast) return undefined;
    const leave = setTimeout(() => setToastLeaving(true), 2400);
    const remove = setTimeout(() => setToastRaw(null), 2600);
    return () => {
      clearTimeout(leave);
      clearTimeout(remove);
    };
  }, [toast]);

  function handleUploaded(detail) {
    setUploadOpen(false);
    setStagedFile(null);
    setToast({
      variant: "info",
      title: "Upload received",
      detail: `${detail.lab_name} — review pending`,
    });
    setRefreshTick((n) => n + 1);
    onOpenReview(detail.id);
  }

  function handleDrop(ev) {
    ev.preventDefault();
    setDragging(false);
    const f = ev.dataTransfer?.files?.[0];
    if (f) {
      setStagedFile(f);
      setUploadOpen(true);
    }
  }

  function handleBrowse() {
    fileInputRef.current?.click();
  }

  function onFilePicked(ev) {
    const f = ev.target.files?.[0];
    if (f) {
      setStagedFile(f);
      setUploadOpen(true);
    }
    ev.target.value = "";
  }

  const pending = useMemo(
    () => items.filter((r) => r.status === "uploaded" || r.status === "reviewed"),
    [items]
  );
  const released = useMemo(
    () => items.filter((r) => r.status === "released"),
    [items]
  );

  const totalAlerts = useMemo(
    () => pending.reduce((sum, r) => sum + flaggedCount(r), 0),
    [pending]
  );

  return (
    <div className='lab-page'>
      <button className='lab-back-link' onClick={onBack}>
        <ChevronLeft size={14} /> Back to dashboard
      </button>

      <div className='lab-eyebrow'>Patient Records</div>
      <div className='lab-header'>
        <div>
          <h1 className='lab-header-title'>Lab Results</h1>
          <p className='lab-header-subtitle'>
            {pending.length} pending review
            {totalAlerts > 0 ? ` · ${totalAlerts} flagged values` : ""} ·{" "}
            {released.length} released to patient
          </p>
        </div>
      </div>

      <div className='lab-tabstrip'>
        {TABS.map((t) => (
          <button
            key={t.value}
            className={`lab-tab ${activeTab === t.value ? "active" : ""}`}
            onClick={() => setActiveTab(t.value)}>
            {t.label}
            {t.value === "lab-upload" && pending.length > 0 && (
              <span className='lab-tab-count'>{pending.length}</span>
            )}
          </button>
        ))}
      </div>

      {error && <div className='lab-banner lab-banner-danger'>{error}</div>}

      {/* Drop zone hero */}
      <label
        className={`lab-dropzone-hero ${dragging ? "drag" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}>
        <div className='lab-dropzone-iconwrap'>
          <Upload size={22} />
        </div>
        <div className='lab-dropzone-title'>Drop lab results here</div>
        <div className='lab-dropzone-sub'>
          Up to 25 MB
        </div>
        <div className='lab-dropzone-actions'>
          <button
            type='button'
            className='lab-btn lab-btn-primary'
            onClick={(e) => {
              e.preventDefault();
              handleBrowse();
            }}>
            Browse files
          </button>
        </div>
        <input
          ref={fileInputRef}
          type='file'
          accept='.hl7,.txt,.json,.xml,.pdf,.csv,application/json,application/xml,text/xml,application/pdf,text/csv'
          style={{ display: "none" }}
          onChange={onFilePicked}
        />
      </label>

      {loading ? (
        <div className='lab-group'>
          <div className='lab-group-empty'>
            <span className='lab-spinner' />
          </div>
        </div>
      ) : (
        <>
          {/* Pending Review group */}
          <div className='lab-group'>
            <div className='lab-group-header'>
              <div>
                <h3 className='lab-group-title'>Pending Review</h3>
                <p className='lab-group-sub'>
                  Parsed and ready · not yet visible to patient
                </p>
              </div>
              <span className='lab-group-meta'>
                {pending.length} {pending.length === 1 ? "file" : "files"}
              </span>
            </div>
            <div className='lab-group-body'>
              {pending.length === 0 ? (
                <div className='lab-group-empty'>
                  No results awaiting review. Upload a file above to start.
                </div>
              ) : (
                pending.map((row) => {
                  const p = patientsById[row.patient_id];
                  const flags = flaggedCount(row);
                  const count = entriesCount(row);
                  return (
                    <div
                      key={row.id}
                      className='lab-row'
                      onClick={() => onOpenReview(row.id)}>
                      <div className='lab-row-icon'>
                        <FlaskConical size={18} />
                      </div>
                      <div className='lab-row-info'>
                        <p className='lab-row-title'>
                          {p ? formatPatientName(p) : "Loading…"}
                          <span className='lab-mrn'>
                            {mrn(p, row.patient_id)}
                          </span>
                          {flags > 0 && (
                            <span
                              className={`lab-flagged-badge${
                                hasCritical(row) ? " critical" : ""
                              }`}>
                              {flags} flagged
                            </span>
                          )}
                        </p>
                        <p className='lab-row-meta'>
                          <span>{row.lab_name || "Unnamed lab"}</span>
                          <span className='lab-row-meta-sep'>
                            Collected {formatLongDate(row.collected_at)}
                          </span>
                          <span className='lab-row-meta-sep'>
                            {count} {count === 1 ? "test" : "tests"}
                          </span>
                        </p>
                      </div>
                      <div className='lab-row-actions'>
                        <button
                          className='lab-btn lab-btn-primary'
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenReview(row.id);
                          }}>
                          Review & Release
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Released to Patient group */}
          <div className='lab-group'>
            <div className='lab-group-header'>
              <div>
                <h3 className='lab-group-title'>Released to Patient</h3>
                <p className='lab-group-sub'>
                  Visible in the patient's portal
                </p>
              </div>
              <span className='lab-group-meta'>
                {released.length} {released.length === 1 ? "file" : "files"}
              </span>
            </div>
            <div className='lab-group-body'>
              {released.length === 0 ? (
                <div className='lab-group-empty'>
                  No released results yet.
                </div>
              ) : (
                released.map((row) => {
                  const p = patientsById[row.patient_id];
                  return (
                    <div
                      key={row.id}
                      className='lab-row'
                      onClick={() => onOpenReview(row.id)}>
                      <div className='lab-row-icon released'>
                        <CheckCircle2 size={18} strokeWidth={2.25} />
                      </div>
                      <div className='lab-row-info'>
                        <p className='lab-row-title'>
                          {p ? formatPatientName(p) : "Loading…"}
                          <span className='lab-mrn'>
                            {mrn(p, row.patient_id)}
                          </span>
                        </p>
                        <p className='lab-row-meta'>
                          <span>{row.lab_name || "In-house"}</span>
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
                            onOpenReview(row.id);
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
        </>
      )}

      {uploadOpen && (
        <LabResultUploadModal
          initialFile={stagedFile}
          onClose={() => {
            setUploadOpen(false);
            setStagedFile(null);
          }}
          onUploaded={handleUploaded}
        />
      )}

      <Toast toast={toast} leaving={toastLeaving} />
    </div>
  );
}

function hasCritical(row) {
  if (!row.entries) return false;
  return row.entries.some(
    (e) => e.abnormal_flag === "critical_low" || e.abnormal_flag === "critical_high"
  );
}
