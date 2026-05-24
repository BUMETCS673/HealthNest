import { useEffect, useState } from "react";
import { ChevronLeft, Download } from "lucide-react";
import { labResultsApi } from "./lib/labResultsApi";
import "./labResults.css";

const FLAG_LABELS = {
  normal: "Normal",
  low: "Low",
  high: "High",
  critical_low: "Critical Low",
  critical_high: "Critical High",
  abnormal: "Abnormal",
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

function FlagPill({ flag }) {
  if (!flag || flag === "normal") {
    return <span className='lab-flag lab-flag-normal'>{FLAG_LABELS[flag] || "Normal"}</span>;
  }
  return (
    <span className={`lab-flag lab-flag-${flag}`}>
      <span className='lab-flag-dot' />
      {FLAG_LABELS[flag] || flag}
    </span>
  );
}

export default function LabResultDetail({ labResultId, onBack }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let alive = true;
    labResultsApi
      .get(labResultId)
      .then((r) => {
        if (!alive) return;
        setResult(r);
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

  async function handleDownload() {
    setDownloading(true);
    try {
      const { url } = await labResultsApi.fileUrl(labResultId);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(e.message);
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return (
      <div className='lab-page'>
        <span className='lab-spinner' />
      </div>
    );
  }

  if (error || !result) {
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

  const abnormalCount = (result.entries || []).filter(
    (e) => e.abnormal_flag && e.abnormal_flag !== "normal"
  ).length;

  return (
    <div className='lab-page'>
      <button className='lab-back-link' onClick={onBack}>
        <ChevronLeft size={14} /> Back to lab results
      </button>

      <div className='lab-header'>
        <div>
          <h1 className='lab-header-title'>{result.lab_name}</h1>
          <p className='lab-header-subtitle'>
            Collected {fmtDate(result.collected_at)} · Resulted{" "}
            {fmtDate(result.resulted_at)}
          </p>
        </div>
        <div className='lab-header-actions'>
          <button
            className='lab-btn'
            onClick={handleDownload}
            disabled={downloading}>
            <Download size={14} />
            {downloading ? "Preparing…" : "Download file"}
          </button>
        </div>
      </div>

      {abnormalCount > 0 && (
        <div className='lab-banner lab-banner-info'>
          {abnormalCount}{" "}
          {abnormalCount === 1 ? "value is" : "values are"} outside the
          reference range. Please discuss with your provider.
        </div>
      )}

      <div className='lab-card'>
        <div className='lab-card-header'>
          <div>
            <h3 className='lab-card-title'>Results ({result.entries?.length || 0})</h3>
            <p className='lab-card-subtitle'>
              Released {fmtDate(result.released_at)}
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
              <th>Reference range</th>
              <th>Flag</th>
            </tr>
          </thead>
          <tbody>
            {(result.entries || []).map((e) => {
              const isCritical =
                e.abnormal_flag === "critical_low" ||
                e.abnormal_flag === "critical_high";
              return (
                <tr key={e.id} className={isCritical ? "critical" : ""}>
                  <td className='component'>
                    <div className='lab-component-name'>{e.component_name}</div>
                  </td>
                  <td className='loinc'>{e.loinc_code || "—"}</td>
                  <td
                    className='value'
                    style={{
                      textAlign: "right",
                      fontVariantNumeric: "tabular-nums",
                      fontWeight: isCritical ? 600 : 500,
                    }}>
                    {e.value ?? e.value_numeric ?? "—"}
                  </td>
                  <td className='unit'>{e.unit || ""}</td>
                  <td className='range'>{e.reference_range || "—"}</td>
                  <td className='flag'>
                    <FlagPill flag={e.abnormal_flag} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
