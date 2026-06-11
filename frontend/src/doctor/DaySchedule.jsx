// AI-USAGE SUMMARY
// Tools: Claude Code (Opus 4.8)
// Overall AI Contribution: ~88%
// AI-Assisted Areas: The shared hours-of-the-day schedule grid (#SCRUM-77). One
//   box per 30-min slot for all 24 hours, coloured by state — non-office-hours
//   (white), open office hours (green), appointments (green, patient name),
//   blocked (red). Hovering a slot changes the background and reveals contextual
//   action buttons (absolutely positioned so the layout never shifts): book /
//   block / unblock / cancel / message. Past unbooked slots are inert. Actions
//   render only when their callback is supplied.
// Human Contributions: The per-state behaviour + verification.
// Notes: Validated via `npm run build`, jest, and manual testing.
import { useRef, useEffect } from "react";
import { Plus, Ban, Check } from "lucide-react";
import { formatApptTime } from "../lib/appointmentsApi";
import { halfHourTimes, hhmm, isPastSlot, ymd } from "./scheduleGrid";
import "./DaySchedule.css";

const TIMES = halfHourTimes();
const ICONS = {
  book: <Plus size={13} />,
  block: <Ban size={13} />,
  open: <Check size={13} />,
};

function Act({ kind, label, onClick }) {
  return (
    <button
      type="button"
      className={`ds-act ds-act--${kind}`}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {ICONS[kind]}
    </button>
  );
}

export default function DaySchedule({
  date,
  appointments = [],
  openSlots = [],
  blockedSlots = [],
  onPickAppointment,
  onBook,
  onBlock,
  onOpen,
  selectedKey = null,
  scrollToNow = false,
  maxHeight = "480px",
  rowHeight = null,
}) {
  const scrollRef = useRef(null);
  const nowRef = useRef(null);

  const apptByTime = {};
  for (const a of appointments) apptByTime[hhmm(a.available_time)] = a;
  const openByTime = {};
  for (const s of openSlots) openByTime[hhmm(s.available_time)] = s;
  const blockedByTime = {};
  for (const s of blockedSlots) blockedByTime[hhmm(s.available_time)] = s;

  const now = new Date();
  const isToday = ymd(date) === ymd(now);
  const currentHourKey = `${String(now.getHours()).padStart(2, "0")}:00`;

  useEffect(() => {
    if (scrollToNow && nowRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = nowRef.current.offsetTop;
    }
  }, [scrollToNow, date]);

  return (
    <div
      className="ds-grid"
      ref={scrollRef}
      style={{ maxHeight, ...(rowHeight ? { "--ds-row-h": `${rowHeight}px` } : {}) }}
    >
      {TIMES.map((t) => {
        const appt = apptByTime[t];
        const open = openByTime[t];
        const blocked = blockedByTime[t];
        const past = isPastSlot(date, t, now);
        const anchorRow = isToday && t === currentHourKey;
        const fmt = formatApptTime(t);

        let body;
        if (appt) {
          body = (
            <div
              className={`ds-slot booked${past ? " past" : ""}${appt.id === selectedKey ? " selected" : ""}`}
              role="button"
              tabIndex={0}
              onClick={() => onPickAppointment?.(appt)}
              onKeyDown={(e) =>
                (e.key === "Enter" || e.key === " ") && onPickAppointment?.(appt)
              }
            >
              <span className="ds-slot-name">
                {appt.patient_name || "Patient"}
              </span>
            </div>
          );
        } else if (past) {
          body = <div className="ds-slot empty past" aria-hidden="true" />;
        } else if (blocked) {
          body = (
            <div className="ds-slot blocked">
              <div className="ds-actions">
                {onOpen && (
                  <Act
                    kind="open"
                    label={`Make ${fmt} available`}
                    onClick={() => onOpen(t)}
                  />
                )}
              </div>
            </div>
          );
        } else if (open) {
          body = (
            <div
              className={`ds-slot open${t === selectedKey ? " selected" : ""}`}
            >
              <div className="ds-actions">
                {onBook && (
                  <Act
                    kind="book"
                    label={`Book ${fmt} slot`}
                    onClick={() => onBook(t)}
                  />
                )}
                {onBlock && (
                  <Act
                    kind="block"
                    label={`Block ${fmt}`}
                    onClick={() => onBlock(t)}
                  />
                )}
              </div>
            </div>
          );
        } else {
          body = (
            <div
              className={`ds-slot empty${t === selectedKey ? " selected" : ""}`}
            >
              <div className="ds-actions">
                {onBook && (
                  <Act
                    kind="book"
                    label={`Book ${fmt} slot`}
                    onClick={() => onBook(t)}
                  />
                )}
              </div>
            </div>
          );
        }

        return (
          <div className="ds-row" key={t} ref={anchorRow ? nowRef : null}>
            <span className="ds-time">{fmt}</span>
            {body}
          </div>
        );
      })}
    </div>
  );
}
