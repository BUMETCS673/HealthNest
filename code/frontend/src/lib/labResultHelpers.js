/*
 * AI-generated code: 40% (tool: Claude; helper extraction and structure)
 * Human code: 60% (defined business rules, verified against LabResultsPage.jsx and PatientLabResultsPage.jsx)
 */

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

//Formats into a readable short date
export function formatLongDate(iso) {
  if (!iso) return "Pending";
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

//Counts the number of flagged entries in a lab result row
export function flaggedCount(row) {
  if (typeof row.flagged_count === "number") {
    return row.flagged_count;
  }

  if (!Array.isArray(row.entries)) {
    return 0;
  }

  return row.entries.filter(
    (entry) => entry.abnormal_flag && entry.abnormal_flag !== "normal",
  ).length;
}

//Formats an MRN for display, adding the MRN- prefix
export function formatMrn(patient, patientId) {
  const raw = patient?.mrn;

  if (raw) {
    return /^mrn[-\s]/i.test(raw) ? raw : `MRN-${raw}`;
  }

  if (!patientId) {
    return "—";
  }

  return `MRN-${patientId.slice(0, 5).toUpperCase()}`;
}

//Counts the total number of entries in a lab result row
export function entriesCount(row) {
  if (typeof row.entries_count === "number") {
    return row.entries_count;
  }

  if (!Array.isArray(row.entries)) {
    return 0;
  }

  return row.entries.length;
}

//Checks any critical flags.
export function hasCritical(row) {
  if (!Array.isArray(row.entries)) {
    return false;
  }

  return row.entries.some(
    (entry) =>
      entry.abnormal_flag === "critical_low" ||
      entry.abnormal_flag === "critical_high",
  );
}
