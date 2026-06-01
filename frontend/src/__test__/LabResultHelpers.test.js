/*
 * AI-usage: 30% (tool: Claude; helped with basic test setup)
 * Human code: 70% (Chose the test cases, expected results, and checked
 * them against the actual Lab Results page behavior)
 */

import {
  formatLongDate,
  flaggedCount,
  formatMrn,
  entriesCount,
  hasCritical,
} from "../lib/labResultHelpers";

describe("Lab Result helper tests", () => {
  // Date formatting helper test
  describe("formatLongDate", () => {
    test("formats an ISO date into a readable date", () => {
      expect(formatLongDate("2026-06-15T00:00:00")).toBe("Jun 15, 2026");
    });

    test("shows Pending when the date is null", () => {
      expect(formatLongDate(null)).toBe("Pending");
    });

    test("shows Pending when the date is undefined", () => {
      expect(formatLongDate(undefined)).toBe("Pending");
    });

    test("formats a January date correctly", () => {
      expect(formatLongDate("2026-01-01T00:00:00")).toBe("Jan 1, 2026");
    });

    test("formats a December date correctly", () => {
      expect(formatLongDate("2026-12-31T00:00:00")).toBe("Dec 31, 2026");
    });
  });

  // Flagged result count helper test
  describe("flaggedCount", () => {
    test("uses flagged_count when the backend gives that value", () => {
      expect(flaggedCount({ flagged_count: 3 })).toBe(3);
    });

    test("returns 0 when there are no entries", () => {
      expect(flaggedCount({})).toBe(0);
    });

    test("counts entries that are marked abnormal", () => {
      const row = {
        entries: [
          { abnormal_flag: "high" },
          { abnormal_flag: "normal" },
          { abnormal_flag: "low" },
          { abnormal_flag: null },
        ],
      };

      expect(flaggedCount(row)).toBe(2);
    });

    test("does not count normal entries as flagged", () => {
      const row = {
        entries: [{ abnormal_flag: "normal" }, { abnormal_flag: "normal" }],
      };

      expect(flaggedCount(row)).toBe(0);
    });

    test("returns 0 when the entries list is empty", () => {
      expect(flaggedCount({ entries: [] })).toBe(0);
    });
  });

  // Patient MRN display helper test
  describe("formatMrn", () => {
    test("keeps the MRN the same when it already has the prefix", () => {
      expect(formatMrn({ mrn: "MRN-12345" }, "patient-1")).toBe("MRN-12345");
    });

    test("adds the MRN prefix when it is missing", () => {
      expect(formatMrn({ mrn: "12345" }, "patient-1")).toBe("MRN-12345");
    });

    test("uses the patient id when the patient MRN is missing", () => {
      expect(formatMrn(null, "abcde12345")).toBe("MRN-ABCDE");
    });

    test("returns a dash when there is no patient or patient id", () => {
      expect(formatMrn(null, null)).toBe("—");
    });
  });

  // Entry count helper test
  describe("entriesCount", () => {
    test("uses entries_count when the backend gives that value", () => {
      expect(entriesCount({ entries_count: 5 })).toBe(5);
    });

    test("returns 0 when there are no entries", () => {
      expect(entriesCount({})).toBe(0);
    });

    test("counts how many entries are in the row", () => {
      const row = {
        entries: [
          { test_name: "CBC" },
          { test_name: "HbA1c" },
          { test_name: "Lipid Panel" },
        ],
      };

      expect(entriesCount(row)).toBe(3);
    });

    test("returns 0 when the entries list is empty", () => {
      expect(entriesCount({ entries: [] })).toBe(0);
    });
  });

  // Critical flag helper tests
  describe("hasCritical", () => {
    test("returns false when there are no entries", () => {
      expect(hasCritical({})).toBe(false);
    });

    test("returns true when an entry is critical high", () => {
      const row = {
        entries: [{ abnormal_flag: "critical_high" }],
      };

      expect(hasCritical(row)).toBe(true);
    });

    test("returns true when an entry is critical low", () => {
      const row = {
        entries: [{ abnormal_flag: "critical_low" }],
      };

      expect(hasCritical(row)).toBe(true);
    });

    test("returns false when entries are abnormal but not critical", () => {
      const row = {
        entries: [{ abnormal_flag: "high" }, { abnormal_flag: "normal" }],
      };

      expect(hasCritical(row)).toBe(false);
    });

    test("returns false when the entries list is empty", () => {
      expect(hasCritical({ entries: [] })).toBe(false);
    });
  });
});
