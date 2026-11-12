// AI-USAGE SUMMARY
// Tools: Claude Code (Opus 4.8)
// Overall AI Contribution: ~85%
// AI-Assisted Areas: A small confirm dialog in the scheduling design language
//   (the shared sm-* modal styles) used for cancelling appointments — supports a
//   destructive variant, a busy state, and an inline error message.
// Human Contributions: Visual direction (match the other scheduling modals).
// Notes: Validated via `npm run build` and jest.
import { X } from "lucide-react";

export default function ConfirmDialog({
  open,
  title,
  message,
  error,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;
  return (
    <div
      className="sm-overlay"
      onClick={(e) => e.target === e.currentTarget && !busy && onCancel?.()}
      role="dialog"
      aria-modal="true"
    >
      <div className="sm-modal sm-modal--narrow">
        <div className="sm-head">
          <h2 className="sm-title">{title}</h2>
          <button
            className="sm-close"
            onClick={onCancel}
            disabled={busy}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <p className="sm-confirm-msg">{message}</p>
        {error && <p className="sm-error">{error}</p>}

        <div className="sm-confirm-actions">
          <button
            type="button"
            className="sm-ghost-btn"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`sm-solid-btn${destructive ? " sm-solid-btn--danger" : ""}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
