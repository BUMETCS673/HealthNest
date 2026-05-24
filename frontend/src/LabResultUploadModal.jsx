import { useState } from "react";
import { Upload, X, FileText } from "lucide-react";
import { labResultsApi } from "./lib/labResultsApi";
import PatientTypeahead from "./PatientTypeahead";
import "./labResults.css";

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export default function LabResultUploadModal({ onClose, onUploaded }) {
  const [file, setFile] = useState(null);
  const [patient, setPatient] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const valid = !!file && !!patient;

  async function handleSubmit() {
    if (!valid) return;
    setSubmitting(true);
    setError(null);
    try {
      const detail = await labResultsApi.upload({
        file,
        patientId: patient.id,
      });
      onUploaded(detail);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  function onDrop(ev) {
    ev.preventDefault();
    setDragging(false);
    const f = ev.dataTransfer?.files?.[0];
    if (f) setFile(f);
  }

  return (
    <div
      className='lab-modal-backdrop'
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}>
      <div className='lab-modal'>
        <div className='lab-modal-header'>
          <h3 className='lab-modal-title'>Upload lab result</h3>
          <button className='lab-modal-close' onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className='lab-modal-body'>
          <label
            className={`lab-dropzone ${dragging ? "drag" : ""} ${
              file ? "picked" : ""
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}>
            {file ? (
              <>
                <FileText size={20} className='lab-dropzone-icon' />
                <div>
                  <div className='lab-dropzone-name'>{file.name}</div>
                  <div className='lab-dropzone-size'>
                    {formatBytes(file.size)}
                  </div>
                </div>
              </>
            ) : (
              <>
                <Upload size={22} style={{ marginBottom: 8 }} />
                <div>
                  <strong>Drop a file</strong> or click to browse
                </div>
                <div className='lab-field-hint' style={{ marginTop: 4 }}>
                  HL7 v2, FHIR JSON, or FHIR XML
                </div>
              </>
            )}
            <input
              type='file'
              accept='.hl7,.txt,.json,.xml,application/json,application/xml,text/xml'
              style={{ display: "none" }}
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>

          <div className='lab-field'>
            <label>Patient</label>
            <PatientTypeahead value={patient} onChange={setPatient} />
            <span className='lab-field-hint'>
              Only patients with an active care-team relationship to you appear here.
            </span>
          </div>

          {error && (
            <div className='lab-banner lab-banner-danger'>{error}</div>
          )}
        </div>

        <div className='lab-modal-footer'>
          <button className='lab-btn' onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            className='lab-btn lab-btn-primary'
            disabled={!valid || submitting}
            onClick={handleSubmit}>
            {submitting ? (
              <>
                <span className='lab-spinner' /> Uploading…
              </>
            ) : (
              <>
                <Upload size={14} /> Upload & review
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
