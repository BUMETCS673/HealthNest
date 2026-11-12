/*
 * AI-generated code: 50% (tool: ChatGPT; initial Jest test structure and starter helper function examples)
 * Human code: 45% (defined expected behavior, adjusted test cases, reviewed helper logic)
 * Framework-generated code: 5% (Jest/Babel/npm setup and configuration)
 */

export function formatApptTime(time) {
  if (!time) return "";
  const timeParts = time.split(":");
  let hour = Number(timeParts[0]);
  const minute = timeParts[1];
  let period = "AM";

  if (hour >= 12) {
    period = "PM";
  }

  if (hour === 0) {
    hour = 12;
  } else if (hour > 12) {
    hour = hour - 12;
  }

  return hour + ":" + minute + " " + period;
}

export function formatApptDate(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "long",
    day: "numeric",
  });
}

export function parseLocal(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function weekStart(d) {
  const day = new Date(d);
  const dow = day.getDay();
  day.setDate(day.getDate() - dow);
  return day;
}

export function weekKeys(sunday) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    return toDateKey(d);
  });
}
