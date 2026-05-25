/**
 * AI-USAGE SUMMARY
 * Tools: Opus 4.7
 * Overall AI Contribution: ~55%
 * AI-Assisted Areas: Generated the component shell, variant-to-icon mapping, and the role="status" / aria-live="polite" accessibility wiring.
 * Human Contributions: Variant taxonomy (success/info/neutral), the leaving-prop pattern for parent-controlled fade-out, and the title+detail two-line layout rather than a single-line pill.
 */
import { CheckCircle2, Info, Archive } from "lucide-react";
import "./labResults.css";

const ICONS = {
  success: CheckCircle2,
  info: Info,
  neutral: Archive,
};

export default function Toast({ toast, leaving = false }) {
  if (!toast) return null;
  const variant = toast.variant || "neutral";
  const Icon = ICONS[variant] || Archive;

  return (
    <div
      className={`lab-toast${leaving ? " leaving" : ""}`}
      role='status'
      aria-live='polite'>
      <span className={`lab-toast-icon lab-toast-icon-${variant}`}>
        <Icon size={13} strokeWidth={2.5} />
      </span>
      <span className='lab-toast-text'>
        <span className='lab-toast-title'>{toast.title}</span>
        {toast.detail && (
          <span className='lab-toast-detail'>{toast.detail}</span>
        )}
      </span>
    </div>
  );
}
