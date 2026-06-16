import {
  formatApptTime,
  formatApptDate,
  parseLocal,
  toDateKey,
  weekStart,
  weekKeys,
} from "../lib/appointmentHelpers";
import { apptToDisplayRow } from "../lib/appointmentsApi";

describe("Appointment Scheduler helper tests", () => {
  describe("formatApptTime", () => {
    test("formats a morning appointment time", () => {
      expect(formatApptTime("10:30")).toBe("10:30 AM");
    });

    test("formats an afternoon appointment time", () => {
      expect(formatApptTime("14:30")).toBe("2:30 PM");
    });

    test("keeps noon in the correct format", () => {
      expect(formatApptTime("12:00")).toBe("12:00 PM");
    });

    test("formats midnight correctly", () => {
      expect(formatApptTime("00:01")).toBe("12:01 AM");
    });

    test("returns an empty string if no time is provided", () => {
      expect(formatApptTime(null)).toBe("");
    });
  });

  describe("formatApptDate", () => {
    test("shows the correct month name", () => {
      expect(formatApptDate("2026-06-15")).toContain("June");
    });

    test("shows the correct day number", () => {
      expect(formatApptDate("2026-06-15")).toContain("15");
    });
  });

  describe("apptToDisplayRow", () => {
    const appointment = {
      id: 1,
      status: "scheduled",
      providers: {
        first_name: "Taylor",
        last_name: "Smith",
        specialty: "Primary Care",
      },
      provider_availability: {
        available_date: "2026-06-20",
        available_time: "09:30",
      },
    };

    test("formats appointment data for the appointment card", () => {
      const result = apptToDisplayRow(appointment);
      expect(result).toMatchObject({
        id: 1,
        doctor: "Taylor Smith",
        specialty: "Primary Care",
        time: "9:30 AM",
        month: "Jun",
        day: "20",
        status: "scheduled",
      });
    });

    test("degrades gracefully when the join data is missing", () => {
      const result = apptToDisplayRow({
        ...appointment,
        provider_availability: null,
      });
      expect(result.time).toBe("");
      expect(result.month).toBe("");
    });
  });

  describe("parseLocal", () => {
    test("reads a date string as the correct local date", () => {
      const date = parseLocal("2026-06-15");

      expect(date.getFullYear()).toBe(2026);
      expect(date.getMonth()).toBe(5);
      expect(date.getDate()).toBe(15);
    });
  });

  describe("toDateKey", () => {
    test("changes a Date object into YYYY-MM-DD format", () => {
      expect(toDateKey(new Date(2026, 5, 15))).toBe("2026-06-15");
    });

    test("adds leading zeros to month and day when needed", () => {
      expect(toDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
    });
  });

  describe("weekStart", () => {
    test("finds the Sunday for the selected week", () => {
      const wednesday = new Date(2026, 5, 17);
      const sunday = weekStart(wednesday);

      expect(sunday.getDay()).toBe(0);
      expect(toDateKey(sunday)).toBe("2026-06-14");
    });
  });

  describe("weekKeys", () => {
    test("creates seven date keys for one full week", () => {
      const sunday = new Date(2026, 5, 14);
      const keys = weekKeys(sunday);

      expect(keys).toHaveLength(7);
      expect(keys[0]).toBe("2026-06-14");
      expect(keys[6]).toBe("2026-06-20");
    });
  });
});
