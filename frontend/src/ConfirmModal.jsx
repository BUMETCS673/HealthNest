/**
 * AI-USAGE SUMMARY
 * Tools: Opus 4.7
 * Overall AI Contribution: ~65%
 * AI-Assisted Areas: Drafted the modal markup using the existing lab-modal-* class vocabulary, the Escape-to-cancel keyboard handler, and the busy-state spinner integration.
 * Human Contributions: Designed the prop API (destructive, busy, confirmLabel/cancelLabel), decided to block backdrop close during busy state, and chose to make this reusable rather than inline to the archive flow.
 */
import { useEffect } from "react";
import { X, AlertTriangle } from "lucide-react";
import "./labResults.css";

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (ev) => {
      if (ev.key === "Escape" && !busy) onCancel?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const confirmClass = destructive
    ? "lab-btn lab-btn-danger"
    : "lab-btn lab-btn-primary";

  return (
    <div
      className='lab-modal-backdrop'
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel?.();
      }}
      role='dialog'
      aria-modal='true'
      aria-labelledby='lab-confirm-title'>
      <div className='lab-modal' style={{ maxWidth: 420 }}>
        <div className='lab-modal-header'>
          <h3
            id='lab-confirm-title'
            className='lab-modal-title'
            style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {destructive && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  background: "#fef3f1",
                  color: "#c02e1a",
                }}>
                <AlertTriangle size={16} />
              </span>
            )}
            {title}
          </h3>
          <button
            className='lab-modal-close'
            onClick={onCancel}
            disabled={busy}
            aria-label='Close'>
            <X size={18} />
          </button>
        </div>

        <div
          className='lab-modal-body'
          style={{ fontSize: 14, color: "#71716e", lineHeight: 1.5 }}>
          {message}
        </div>

        <div className='lab-modal-footer'>
          <button className='lab-btn' onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            className={confirmClass}
            onClick={onConfirm}
            disabled={busy}
            autoFocus>
            {busy ? (
              <>
                <span className='lab-spinner' /> Working…
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
