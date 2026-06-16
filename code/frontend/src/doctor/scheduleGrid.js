/**
 * AI-USAGE SUMMARY
 * Tools: Claude Code (Opus 4.8)
 * Overall AI Contribution: ~90%
 * AI-Assisted Areas: Shared date/time helpers for the provider schedule grids —
 *   half-hour slot generation, week/month anchors, and past-slot detection.
 * Human Contributions: The 30-minute slot convention and week-starts-Monday
 *   choice.
 * Notes: Validated via jest.
 */

/** Local YYYY-MM-DD (no timezone shift). */
export function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Sunday of the week containing `d` (Google-Calendar-style week start). */
export function startOfWeek(d) {
  const x = new Date(d);
  return addDays(x, -x.getDay()); // Sun = 0
}

export function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** First 5 chars of a "HH:MM[:SS]" string. */
export function hhmm(t) {
  return (t || "").slice(0, 5);
}

/** All 30-minute start times of a day: "00:00" .. "23:30". */
export function halfHourTimes() {
  const out = [];
  for (let h = 0; h < 24; h += 1) {
    for (const m of [0, 30]) {
      out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return out;
}

/** True if the slot at `date` + "HH:MM" is before `now`. */
export function isPastSlot(date, time, now = new Date()) {
  const [h, m] = time.split(":").map(Number);
  const slot = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    h,
    m,
  );
  return slot < now;
}
