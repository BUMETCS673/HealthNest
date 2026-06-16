// AI-USAGE SUMMARY
// Tools: Claude Code (Opus 4.8)
// Overall AI Contribution: ~90%
// AI-Assisted Areas: Shared light-dismiss overlay for the global side drawers
//   (Messages + Pulse / Dfa). Since the drawers are non-modal and can be open at
//   once, a single faint click-catcher restores "click outside to dismiss": it
//   sits below the drawers and their launchers, and closing it closes every open
//   drawer. Each drawer keeps its own × and Escape.
// Human Contributions: UX direction (both-open + click-away to close).
// Notes: Validated via `npm run build` and manual testing.
import "./DrawerScrim.css";

export default function DrawerScrim({ open, onClose }) {
  if (!open) return null;
  return <div className="drawer-scrim" onClick={onClose} aria-hidden="true" />;
}
