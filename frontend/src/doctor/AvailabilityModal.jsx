// AI-USAGE SUMMARY
// Tools: Claude Code (Opus 4.8)
// Overall AI Contribution: ~88%
// AI-Assisted Areas: The Office Hours modal (#SCRUM-77) — a week-style grid
//   (Sun–Sat × 30-min rows) for setting recurring weekly availability with
//   anchor-based click-and-drag painting (each move repaints the rectangle from
//   the drag anchor, so fast drags that skip cells never leave gaps). Existing
//   recurrence rules pre-fill the grid; on save the painted cells are merged
//   into contiguous per-weekday ranges and rewritten as the provider's
//   office-hours rules. The save is non-destructive: new rules are added first
//   and the old ones removed only after every add succeeds, so a failure can
//   never wipe existing office hours; a stale "rule not found" on delete is
//   tolerated and any unexpected error surfaces a friendly message. One-off
//   availability and blocks are handled in the calendar and override these.
// Human Contributions: Reported the fast-drag gaps and the destructive-save
//   bug that had wiped the rules; UX decisions and verification.
// Notes: Validated via `npm run build`, jest, eslint, and manual testing. The
//   rule wipe was diagnosed against the live DB (availability_rules had been
//   emptied); restored by re-painting in the grid since the save is now safe.
import { useState, useEffect, useRef, useCallback } from "react";
import { X } from "lucide-react";
import { schedulingApi } from "../lib/schedulingApi";
import { halfHourTimes, hhmm } from "./scheduleGrid";

// Display order is Sun–Sat (calendar starts Sunday); values use Python's
// weekday() convention (Mon=0 … Sun=6) to match the backend.
const COLUMNS = [
  { label: "Sun", value: 6 },
  { label: "Mon", value: 0 },
  { label: "Tue", value: 1 },
  { label: "Wed", value: 2 },
  { label: "Thu", value: 3 },
  { label: "Fri", value: 4 },
  { label: "Sat", value: 5 },
];

const TIMES = halfHourTimes();
const cellKey = (wd, t) => `${wd}|${t}`;

function addHalfHour(t) {
  const [h, m] = t.split(":").map(Number);
  const total = h * 60 + m + 30;
  if (total >= 24 * 60) return "23:59";
  const nh = String(Math.floor(total / 60)).padStart(2, "0");
  const nm = String(total % 60).padStart(2, "0");
  return `${nh}:${nm}`;
}

// Turn a sorted list of 30-min start times into contiguous [start, end) ranges.
function mergeRanges(times) {
  const ranges = [];
  let start = null;
  let prev = null;
  for (const t of times) {
    if (start === null) {
      start = t;
      prev = t;
    } else if (addHalfHour(prev) === t) {
      prev = t;
    } else {
      ranges.push([start, addHalfHour(prev)]);
      start = t;
      prev = t;
    }
  }
  if (start !== null) ranges.push([start, addHalfHour(prev)]);
  return ranges;
}

function cellsFromRules(rules) {
  const set = new Set();
  for (const r of rules) {
    const start = hhmm(r.start_time);
    const end = hhmm(r.end_time);
    for (const t of TIMES) {
      if (t >= start && t < end) set.add(cellKey(r.weekday, t));
    }
  }
  return set;
}

function fmtLabel(t) {
  const [h] = t.split(":").map(Number);
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12} ${ampm}`;
}

export default function AvailabilityModal({ rules, onClose, onSaved }) {
  const [cells, setCells] = useState(() => cellsFromRules(rules));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  // { add, anchorCol, anchorRow, base } — base is the cell set when the drag
  // began, so each move repaints the rectangle from the anchor without
  // accumulating, and fast drags that skip cells can't leave gaps.
  const dragRef = useRef(null);
  const bodyRef = useRef(null);

  // Scroll to ~8 AM on open.
  useEffect(() => {
    if (bodyRef.current) {
      const idx = TIMES.indexOf("08:00");
      if (idx > 0) bodyRef.current.scrollTop = idx * 19;
    }
  }, []);

  // Paint the rectangle from the drag anchor to (ci, ti) onto the base set.
  const paintTo = useCallback((ci, ti) => {
    const d = dragRef.current;
    if (!d) return;
    const c0 = Math.min(d.anchorCol, ci);
    const c1 = Math.max(d.anchorCol, ci);
    const r0 = Math.min(d.anchorRow, ti);
    const r1 = Math.max(d.anchorRow, ti);
    const next = new Set(d.base);
    for (let c = c0; c <= c1; c++) {
      for (let r = r0; r <= r1; r++) {
        const key = cellKey(COLUMNS[c].value, TIMES[r]);
        if (d.add) next.add(key);
        else next.delete(key);
      }
    }
    setCells(next);
  }, []);

  const onCellDown = (ci, ti) => {
    const key = cellKey(COLUMNS[ci].value, TIMES[ti]);
    dragRef.current = {
      add: !cells.has(key),
      anchorCol: ci,
      anchorRow: ti,
      base: cells,
    };
    paintTo(ci, ti);
  };

  const onCellEnter = (ci, ti) => {
    if (dragRef.current) paintTo(ci, ti);
  };

  useEffect(() => {
    const end = () => {
      dragRef.current = null;
    };
    window.addEventListener("mouseup", end);
    return () => window.removeEventListener("mouseup", end);
  }, []);

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      // Add the new rules FIRST so a failure can never wipe existing office
      // hours. Only once they all succeed do we remove the previous rules.
      for (const col of COLUMNS) {
        const times = [...cells]
          .filter((k) => k.startsWith(`${col.value}|`))
          .map((k) => k.split("|")[1])
          .sort();
        for (const [start, endTime] of mergeRanges(times)) {
          await schedulingApi.addRule({
            weekdays: [col.value],
            start_time: start,
            end_time: endTime,
            effective_from: null,
            effective_until: null,
          });
        }
      }
      // A rule may already be gone (stale list) — treat "not found" as removed.
      await Promise.all(
        rules.map((r) =>
          schedulingApi.deleteRule(r.id).catch((err) => {
            if (!/not found/i.test(err.message || "")) throw err;
          }),
        ),
      );
      onSaved?.();
      onClose?.();
    } catch {
      setError("Update failed. Please try again later.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="sm-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="sm-modal sm-modal--wide">
        <div className="sm-head">
          <h2 className="sm-title">Office Hours</h2>
          <button className="sm-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <p className="sm-hint">
          Click and drag to set your recurring weekly availability. Changes you
          make in the calendar (add, block) override these.
        </p>

        <div className="oh-grid">
          <div className="oh-head">
            <div className="oh-corner" />
            {COLUMNS.map((c) => (
              <div key={c.value} className="oh-day">
                {c.label}
              </div>
            ))}
          </div>
          <div className="oh-body" ref={bodyRef}>
            {TIMES.map((t, ti) => (
              <div className="oh-row" key={t}>
                <span className="oh-time">
                  {t.endsWith(":00") ? fmtLabel(t) : ""}
                </span>
                {COLUMNS.map((c, ci) => {
                  const on = cells.has(cellKey(c.value, t));
                  return (
                    <div
                      key={c.value}
                      className={`oh-cell${on ? " on" : ""}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        onCellDown(ci, ti);
                      }}
                      onMouseEnter={() => onCellEnter(ci, ti)}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {error && <p className="sm-error">{error}</p>}
        <button className="sm-submit" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save office hours"}
        </button>
      </div>
    </div>
  );
}
