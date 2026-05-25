/**
 * AI-USAGE SUMMARY
 * Tools: Opus 4.7
 * Overall AI Contribution: ~70%
 * AI-Assisted Areas: Generated the editable entries grid, the per-field meta inputs, the per-entry diff calculation that builds the minimal patch payload, the sticky action footer, the eyebrow + MRN-pill header, and the summary stat tiles.
 * Human Contributions: Workflow design (save vs release-with-implicit-patch), the manual-entry-required gating on release, the patient-name resolution wiring, and the decision to mirror server state into a local editable copy with explicit diffing rather than a controlled-from-server pattern.
 */
import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  Download,
  Send,
  Archive,
  Save,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { labResultsApi } from "./lib/labResultsApi";
import {
  patientsApi,
  formatPatientName,
  formatPatientSubtitle,
} from "./lib/patientsApi";
import ConfirmModal from "./ConfirmModal";
import Toast from "./Toast";
import "./labResults.css";

const FLAG_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "low", label: "Low" },
  { value: "high", label: "High" },
  { value: "critical_low", label: "Critical Low" },
  { value: "critical_high", label: "Critical High" },
  { value: "abnormal", label: "Abnormal" },
];

const STATUS_LABELS = {
  uploaded: "Pending review",
  reviewed: "Reviewed",
  released: "Released",
  archived: "Archived",
};

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function mrn(patient, patientId) {
  const raw = patient?.mrn;
  if (raw) return /^mrn[-\s]/i.test(raw) ? raw : `MRN-${raw}`;
  if (!patientId) return "—";
  return `MRN-${patientId.slice(0, 5).toUpperCase()}`;
}

function shortPatient(id) {
  if (!id) return "Patient";
  return `Patient #${id.slice(0, 8)}`;
}

export default function LabResultReview({ labResultId, onBack, onChanged }) {
  const [original, setOriginal] = useState(null);
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [toast, setToastRaw] = useState(null);
  const [toastLeaving, setToastLeaving] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  function setToast(t) {
    setToastLeaving(false);
    setToastRaw(t);
  }

  const [meta, setMeta] = useState({
    lab_name: "",
    ordering_provider_name: "",
    collected_at: "",
    resulted_at: "",
    notes: "",
  });
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    let alive = true;
    labResultsApi
      .get(labResultId)
      .then((r) => {
        if (!alive) return;
        setOriginal(r);
        patientsApi
          .get(r.patient_id)
          .then((p) => alive && setPatient(p))
          .catch(() => {});
        setMeta({
          lab_name: r.lab_name || "",
          ordering_provider_name: r.ordering_provider_name || "",
          collected_at: r.collected_at ? toLocal(r.collected_at) : "",
          resulted_at: r.resulted_at ? toLocal(r.resulted_at) : "",
          notes: r.notes || "",
        });
        setEntries(
          (r.entries || []).map((e) => ({
            id: e.id,
            component_name: e.component_name || "",
            loinc_code: e.loinc_code || "",
            value: e.value ?? (e.value_numeric != null ? String(e.value_numeric) : ""),
            value_numeric: e.value_numeric,
            unit: e.unit || "",
            reference_range: e.reference_range || "",
            abnormal_flag: e.abnormal_flag || "normal",
            needs_manual_entry: !!e.needs_manual_entry,
            display_order: e.display_order ?? 0,
          }))
        );
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
  }, [labResultId]);

  useEffect(() => {
    if (!toast) return undefined;
    const leave = setTimeout(() => setToastLeaving(true), 2400);
    const remove = setTimeout(() => setToastRaw(null), 2600);
    return () => {
      clearTimeout(leave);
      clearTimeout(remove);
    };
  }, [toast]);

  const status = original?.status;
  const isMutable = status === "uploaded" || status === "reviewed";

  const manualEntryRemaining = useMemo(
    () => entries.filter((e) => e.needs_manual_entry && !e.value).length,
    [entries]
  );

  const abnormalCount = useMemo(
    () =>
      entries.filter((e) => e.abnormal_flag && e.abnormal_flag !== "normal")
        .length,
    [entries]
  );

  function updateEntry(index, patch) {
    setEntries((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      if (
        patch.value !== undefined &&
        patch.value &&
        next[index].needs_manual_entry
      ) {
        next[index].needs_manual_entry = false;
      }
      return next;
    });
  }

  function buildPatchPayload({ transition }) {
    const payload = {};
    if (meta.lab_name !== (original.lab_name || ""))
      payload.lab_name = meta.lab_name;
    if (
      meta.ordering_provider_name !== (original.ordering_provider_name || "")
    )
      payload.ordering_provider_name = meta.ordering_provider_name;
    if (meta.collected_at && toIso(meta.collected_at) !== original.collected_at)
      payload.collected_at = toIso(meta.collected_at);
    if (meta.resulted_at && toIso(meta.resulted_at) !== original.resulted_at)
      payload.resulted_at = toIso(meta.resulted_at);
    if (meta.notes !== (original.notes || "")) payload.notes = meta.notes;
    if (transition) payload.transition_to_reviewed = true;

    const origById = new Map((original.entries || []).map((e) => [e.id, e]));
    const changedEntries = [];
    for (const e of entries) {
      const o = origById.get(e.id) || {};
      const numericFromValue = parseNum(e.value);
      const diff = {};
      if (e.value !== (o.value ?? (o.value_numeric != null ? String(o.value_numeric) : "")))
        diff.value = e.value;
      if (
        numericFromValue !== o.value_numeric &&
        !(numericFromValue == null && o.value_numeric == null)
      )
        diff.value_numeric = numericFromValue;
      if (e.unit !== (o.unit || "")) diff.unit = e.unit;
      if (e.reference_range !== (o.reference_range || ""))
        diff.reference_range = e.reference_range;
      if (e.abnormal_flag !== (o.abnormal_flag || "normal"))
        diff.abnormal_flag = e.abnormal_flag;
      if (e.needs_manual_entry !== !!o.needs_manual_entry)
        diff.needs_manual_entry = e.needs_manual_entry;
      if (e.loinc_code !== (o.loinc_code || "")) diff.loinc_code = e.loinc_code;
      if (e.component_name !== (o.component_name || ""))
        diff.component_name = e.component_name;
      if (Object.keys(diff).length > 0) changedEntries.push({ id: e.id, ...diff });
    }
    if (changedEntries.length) payload.entries = changedEntries;
    return payload;
  }

  async function doSave({ transition }) {
    setBusy("save");
    setError(null);
    try {
      const payload = buildPatchPayload({ transition });
      if (Object.keys(payload).length > 0) {
        const updated = await labResultsApi.patch(labResultId, payload);
        setOriginal(updated);
      }
      setToast({
        variant: "success",
        title: transition ? "Marked as reviewed" : "Changes saved",
      });
      onChanged?.();
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setBusy(null);
    }
  }

  async function doRelease() {
    if (manualEntryRemaining > 0) {
      setError(
        `${manualEntryRemaining} ${
          manualEntryRemaining === 1 ? "value still needs" : "values still need"
        } to be entered before releasing.`
      );
      return;
    }
    setBusy("release");
    setError(null);
    try {
      const payload = buildPatchPayload({ transition: false });
      if (Object.keys(payload).length > 0) {
        await labResultsApi.patch(labResultId, payload);
      }
      const released = await labResultsApi.release(labResultId);
      setOriginal(released);
      setToast({
        variant: "success",
        title: "Released to patient",
        detail: patient
          ? `${formatPatientName(patient)} can now see this result`
          : undefined,
      });
      onChanged?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  function doArchive() {
    setArchiveOpen(true);
  }

  async function confirmArchive() {
    setBusy("archive");
    setError(null);
    try {
      const archived = await labResultsApi.archive(labResultId);
      setOriginal(archived);
      setArchiveOpen(false);
      setToast({ variant: "neutral", title: "Result archived" });
      onChanged?.();
    } catch (e) {
      setError(e.message);
      setArchiveOpen(false);
    } finally {
      setBusy(null);
    }
  }

  async function downloadFile() {
    try {
      const { url } = await labResultsApi.fileUrl(labResultId);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(e.message);
    }
  }

  if (loading) {
    return (
      <div className='lab-page'>
        <div className='lab-empty'>
          <span className='lab-spinner' />
        </div>
      </div>
    );
  }

  if (!original) {
    return (
      <div className='lab-page'>
        <button className='lab-back-link' onClick={onBack}>
          <ChevronLeft size={14} /> Back
        </button>
        <div className='lab-banner lab-banner-danger'>
          {error || "Result not found."}
        </div>
      </div>
    );
  }

  const patientSubtitle = patient ? formatPatientSubtitle(patient) : "";

  return (
    <div className='lab-page'>
      <button className='lab-back-link' onClick={onBack}>
        <ChevronLeft size={14} /> Back to lab results
      </button>

      <div className='lab-eyebrow'>Lab result review</div>
      <div className='lab-header'>
        <div>
          <h1 className='lab-header-title'>
            {patient ? formatPatientName(patient) : shortPatient(original.patient_id)}
          </h1>
          <p className='lab-header-subtitle'>
            <span className='lab-mrn' style={{ marginRight: 10 }}>
              {mrn(patient, original.patient_id)}
            </span>
            {patientSubtitle ? `${patientSubtitle} · ` : ""}
            {meta.lab_name || "Lab result"} ·{" "}
            {original.source_format.toUpperCase()} · Uploaded{" "}
            {fmtDate(original.created_at)}
          </p>
        </div>
        <div className='lab-header-actions'>
          <span className={`lab-status lab-status-${status}`}>
            {STATUS_LABELS[status]}
          </span>
          <button className='lab-btn' onClick={downloadFile}>
            <Download size={14} /> File
          </button>
        </div>
      </div>

      <div style={{ height: 24 }} />

      {error && <div className='lab-banner lab-banner-danger'>{error}</div>}
      {manualEntryRemaining > 0 && (
        <div className='lab-banner lab-banner-info'>
          <AlertTriangle size={16} />
          {manualEntryRemaining}{" "}
          {manualEntryRemaining === 1
            ? "value still needs to be entered"
            : "values still need to be entered"}{" "}
          before this result can be released.
        </div>
      )}
      {original.parse_error && (
        <div className='lab-banner lab-banner-info'>
          <AlertTriangle size={16} /> Parser note: {original.parse_error}
        </div>
      )}
      {status === "released" && (
        <div className='lab-banner lab-banner-success'>
          <CheckCircle2 size={16} /> Released to patient on{" "}
          {fmtDate(original.released_at)}
        </div>
      )}

      <div className='lab-review-grid'>
        <div className='lab-card'>
          <div className='lab-card-header'>
            <div>
              <h3 className='lab-card-title'>Result metadata</h3>
              <p className='lab-card-subtitle'>
                Auto-filled by the parser — edit as needed.
              </p>
            </div>
          </div>
          <div className='lab-meta-grid'>
            <div className='lab-meta-field'>
              <label>Lab name</label>
              <input
                value={meta.lab_name}
                disabled={!isMutable}
                onChange={(e) =>
                  setMeta((m) => ({ ...m, lab_name: e.target.value }))
                }
              />
            </div>
            <div className='lab-meta-field'>
              <label>Ordering provider</label>
              <input
                value={meta.ordering_provider_name}
                disabled={!isMutable}
                onChange={(e) =>
                  setMeta((m) => ({
                    ...m,
                    ordering_provider_name: e.target.value,
                  }))
                }
              />
            </div>
            <div className='lab-meta-field'>
              <label>Collected at</label>
              <input
                type='datetime-local'
                value={meta.collected_at}
                disabled={!isMutable}
                onChange={(e) =>
                  setMeta((m) => ({ ...m, collected_at: e.target.value }))
                }
              />
            </div>
            <div className='lab-meta-field'>
              <label>Resulted at</label>
              <input
                type='datetime-local'
                value={meta.resulted_at}
                disabled={!isMutable}
                onChange={(e) =>
                  setMeta((m) => ({ ...m, resulted_at: e.target.value }))
                }
              />
            </div>
            <div
              className='lab-meta-field'
              style={{ gridColumn: "span 2" }}>
              <label>Provider notes (not shown to patient)</label>
              <textarea
                value={meta.notes}
                disabled={!isMutable}
                onChange={(e) =>
                  setMeta((m) => ({ ...m, notes: e.target.value }))
                }
                placeholder='Clinical impression, follow-up needed, etc.'
              />
            </div>
          </div>
        </div>

        <div className='lab-card lab-sidebar-card'>
          <h4>Summary</h4>
          <dl style={{ display: "flex", flexDirection: "column" }}>
            <div className='lab-info-row'>
              <dt>Components</dt>
              <dd>{entries.length}</dd>
            </div>
            <div className='lab-info-row'>
              <dt>Flagged</dt>
              <dd>{abnormalCount}</dd>
            </div>
            <div className='lab-info-row'>
              <dt>Needs entry</dt>
              <dd>{manualEntryRemaining}</dd>
            </div>
            <div className='lab-info-row'>
              <dt>Parser</dt>
              <dd>v{original.parser_version}</dd>
            </div>
            <div className='lab-info-row'>
              <dt>Source</dt>
              <dd>{original.source_format.toUpperCase()}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className='lab-card'>
        <div className='lab-card-header'>
          <div>
            <h3 className='lab-card-title'>
              Components ({entries.length})
            </h3>
            <p className='lab-card-subtitle'>
              Click any cell to edit. Highlighted rows need a manual value or are critical.
            </p>
          </div>
        </div>
        <table className='lab-entries'>
          <thead>
            <tr>
              <th>Component</th>
              <th>LOINC</th>
              <th style={{ textAlign: "right" }}>Value</th>
              <th>Unit</th>
              <th>Reference</th>
              <th>Flag</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, idx) => {
              const isCritical =
                e.abnormal_flag === "critical_low" ||
                e.abnormal_flag === "critical_high";
              const cls = e.needs_manual_entry
                ? "needs-entry"
                : isCritical
                  ? "critical"
                  : "";
              return (
                <tr key={e.id} className={cls}>
                  <td className='component'>
                    <input
                      className='lab-input'
                      value={e.component_name}
                      disabled={!isMutable}
                      onChange={(ev) =>
                        updateEntry(idx, { component_name: ev.target.value })
                      }
                    />
                    {e.needs_manual_entry && (
                      <div className='lab-component-hint'>
                        Needs manual entry
                      </div>
                    )}
                  </td>
                  <td className='loinc'>
                    <input
                      className='lab-input'
                      value={e.loinc_code}
                      disabled={!isMutable}
                      placeholder='—'
                      onChange={(ev) =>
                        updateEntry(idx, { loinc_code: ev.target.value })
                      }
                    />
                  </td>
                  <td className='value'>
                    <input
                      className='lab-input numeric'
                      value={e.value}
                      disabled={!isMutable}
                      placeholder='—'
                      onChange={(ev) =>
                        updateEntry(idx, { value: ev.target.value })
                      }
                    />
                  </td>
                  <td className='unit'>
                    <input
                      className='lab-input unit'
                      value={e.unit}
                      disabled={!isMutable}
                      placeholder='—'
                      onChange={(ev) =>
                        updateEntry(idx, { unit: ev.target.value })
                      }
                    />
                  </td>
                  <td className='range'>
                    <input
                      className='lab-input range'
                      value={e.reference_range}
                      disabled={!isMutable}
                      placeholder='—'
                      onChange={(ev) =>
                        updateEntry(idx, { reference_range: ev.target.value })
                      }
                    />
                  </td>
                  <td className='flag'>
                    <select
                      className={`lab-select lab-flag lab-flag-${e.abnormal_flag}`}
                      value={e.abnormal_flag}
                      disabled={!isMutable}
                      onChange={(ev) =>
                        updateEntry(idx, { abnormal_flag: ev.target.value })
                      }>
                      {FLAG_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className='lab-action-footer'>
        <div className='lab-action-footer-left'>
          {status === "released"
            ? "This result has been released to the patient."
            : status === "archived"
              ? "This result is archived."
              : manualEntryRemaining > 0
                ? `${manualEntryRemaining} pending · cannot release yet`
                : "Ready to release"}
        </div>
        <div className='lab-action-footer-right'>
          {isMutable && (
            <>
              <button
                className='lab-btn lab-btn-danger'
                onClick={doArchive}
                disabled={busy != null}>
                <Archive size={14} /> Archive
              </button>
              <button
                className='lab-btn'
                onClick={() => doSave({ transition: false })}
                disabled={busy != null}>
                {busy === "save" ? (
                  <>
                    <span className='lab-spinner' /> Saving…
                  </>
                ) : (
                  <>
                    <Save size={14} /> Save changes
                  </>
                )}
              </button>
              <button
                className='lab-btn lab-btn-primary'
                onClick={doRelease}
                disabled={busy != null || manualEntryRemaining > 0}>
                {busy === "release" ? (
                  <>
                    <span className='lab-spinner' /> Releasing…
                  </>
                ) : (
                  <>
                    <Send size={14} /> Release to patient
                  </>
                )}
              </button>
            </>
          )}
          {status === "released" && (
            <button
              className='lab-btn lab-btn-danger'
              onClick={doArchive}
              disabled={busy != null}>
              <Archive size={14} /> Archive
            </button>
          )}
        </div>
      </div>

      <ConfirmModal
        open={archiveOpen}
        title='Archive lab result?'
        message={
          <>
            This lab result will be archived. It will no longer appear in
            patient or default provider views.
            {status === "released" && (
              <>
                <br />
                <br />
                <strong>Heads up:</strong> this result has already been released
                to the patient. Archiving will remove it from their dashboard.
              </>
            )}
          </>
        }
        confirmLabel='Archive'
        destructive
        busy={busy === "archive"}
        onConfirm={confirmArchive}
        onCancel={() => {
          if (busy !== "archive") setArchiveOpen(false);
        }}
      />

      <Toast toast={toast} leaving={toastLeaving} />
    </div>
  );
}


function parseNum(s) {
  if (s === "" || s == null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function toLocal(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toIso(local) {
  if (!local) return null;
  return new Date(local).toISOString();
}
