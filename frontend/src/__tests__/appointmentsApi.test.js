import {
  formatApptTime,
  formatApptDate,
  apptToDisplayRow,
  parseLocal,
  toDateKey,
  weekStart,
  weekKeys,
} from "../lib/appointmentHelpers";

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
    // AI-generated sample data: 70% (tool: ChatGPT; generated realistic appointment test data)
    // Human: 30% (verified field names match actual API response shape)
    const appointment = {
      id: 1,
      provider_name: "Dr. Taylor Smith",
      specialty: "Primary Care",
      location: "Main Clinic",
      appointment_date: "2026-06-20",
      appointment_time: "09:30",
      status: "scheduled",
    };

    test("formats appointment data for the appointment card", () => {
      const result = apptToDisplayRow(appointment);

      expect(result).toMatchObject({
        id: 1,
        doctor: "Dr. Taylor Smith",
        specialty: "Primary Care",
        time: "9:30 AM",
        month: "Jun",
        day: "20",
        address: "Main Clinic",
        status: "scheduled",
      });
    });

    test("handles missing location without showing undefined", () => {
      expect(apptToDisplayRow({ ...appointment, location: null }).address).toBe(
        "",
      );
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
