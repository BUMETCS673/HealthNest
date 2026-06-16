/*
 * AI-generated code: 80% (tool: Claude Code / Opus 4.8; render structure)
 * Human code: 20% (defined test cases and verified against actual DaySchedule
 * behavior)
 */

import { render, screen, fireEvent } from "@testing-library/react";
import DaySchedule from "../doctor/DaySchedule";

const today = new Date();

describe("DaySchedule", () => {
  test("renders a booked slot and reports clicks", () => {
    const appt = {
      id: "a1",
      patient_name: "Jane Roe",
      status: "scheduled",
      available_time: "23:30",
    };
    const onPickAppointment = jest.fn();
    render(
      <DaySchedule
        date={today}
        appointments={[appt]}
        onPickAppointment={onPickAppointment}
        onPickEmpty={jest.fn()}
      />,
    );

    expect(screen.getByText("Jane Roe")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Jane Roe"));
    expect(onPickAppointment).toHaveBeenCalledWith(appt);
  });

  test("empty (non-past) slots reveal a book action that reports the time", () => {
    // use a future day so 9 AM is never in the past (past empty slots are inert)
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const onBook = jest.fn();
    render(
      <DaySchedule
        date={tomorrow}
        appointments={[]}
        onBook={onBook}
        onPickAppointment={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Book 9:00 AM slot" }));
    expect(onBook).toHaveBeenCalledWith("09:00");
  });

  test("past slots are dimmed", () => {
    const pastAppt = {
      id: "a2",
      patient_name: "Past Pat",
      status: "scheduled",
      available_time: "00:00", // midnight today is always in the past
    };
    render(
      <DaySchedule
        date={today}
        appointments={[pastAppt]}
        onPickAppointment={jest.fn()}
        onPickEmpty={jest.fn()}
      />,
    );

    const slot = screen.getByText("Past Pat").closest(".ds-slot");
    expect(slot.className).toContain("past");
  });
});
