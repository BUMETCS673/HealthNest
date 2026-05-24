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
