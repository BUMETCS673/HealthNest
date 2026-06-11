/*
AI-USAGE SUMMARY
Tools: Claude Code (Fable 5)
Overall AI Contribution: ~90%
AI-Assisted Areas: Wrote tests for the appointment detail page (render, back
navigation, cancel flow, notes editing, not-found state).
Human Contributions: Requested the single-appointment details page and reviewed
the expected behaviors.
*/

import React from "react";
import "@testing-library/jest-dom";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AppointmentDetailPage from "../appointments/AppointmentDetailPage";
import { appointmentsApi } from "../lib/appointmentsApi";

jest.mock("../lib/appointmentsApi", () => {
  const actual = jest.requireActual("../lib/appointmentsApi");
  return {
    apptToDisplayRow: actual.apptToDisplayRow,
    appointmentsApi: {
      getAppointments: jest.fn(),
      cancelAppointment: jest.fn(),
      editAppointmentNotes: jest.fn(),
    },
  };
});

jest.mock("../messages/MessagesProvider", () => ({
  useMessages: () => ({ unreadCount: 0 }),
}));

jest.mock("../appointments/AppointmentModal", () => ({
  __esModule: true,
  default: () => null,
}));

const rawAppt = {
  id: "appt-1",
  status: "scheduled",
  provider_id: "prov-1",
  notes: "Bring prior records",
  providers: { first_name: "Sam", last_name: "Lee", specialty: "cardiology" },
  provider_availability: {
    available_date: "2099-01-15",
    available_time: "09:30",
  },
};

const mockUser = {
  email: "patient@healthnest.com",
  user_metadata: { first_name: "Alex", last_name: "Morgan", role: "patient" },
};

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

describe("AppointmentDetailPage", () => {
  test("renders the appointment's details", async () => {
    appointmentsApi.getAppointments.mockResolvedValue([rawAppt]);

    render(<AppointmentDetailPage user={mockUser} appointmentId="appt-1" />);

    expect(
      await screen.findByRole("heading", { name: "Sam Lee" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Scheduled")).toBeInTheDocument();
    expect(screen.getByText("cardiology")).toBeInTheDocument();
    expect(screen.getByText("Bring prior records")).toBeInTheDocument();
  });

  test("back button returns to the appointments list", async () => {
    const onNavigate = jest.fn();
    appointmentsApi.getAppointments.mockResolvedValue([rawAppt]);

    render(
      <AppointmentDetailPage
        user={mockUser}
        appointmentId="appt-1"
        onNavigate={onNavigate}
      />,
    );

    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: /All Appointments/ }),
    );

    expect(onNavigate).toHaveBeenCalledWith("appointments");
  });

  test("cancel flow confirms then cancels the appointment", async () => {
    appointmentsApi.getAppointments.mockResolvedValue([rawAppt]);
    appointmentsApi.cancelAppointment.mockResolvedValue({});

    render(<AppointmentDetailPage user={mockUser} appointmentId="appt-1" />);

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /Cancel/ }));
    await user.click(screen.getByRole("button", { name: /Yes, cancel/ }));

    await waitFor(() => {
      expect(appointmentsApi.cancelAppointment).toHaveBeenCalledWith("appt-1");
    });
  });

  test("notes can be edited and saved", async () => {
    appointmentsApi.getAppointments.mockResolvedValue([rawAppt]);
    appointmentsApi.editAppointmentNotes.mockResolvedValue({});

    render(<AppointmentDetailPage user={mockUser} appointmentId="appt-1" />);

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Edit notes" }));

    const input = screen.getByLabelText("Visit notes");
    await user.clear(input);
    await user.type(input, "New question for the doctor");
    await user.click(screen.getByRole("button", { name: "Save notes" }));

    await waitFor(() => {
      expect(appointmentsApi.editAppointmentNotes).toHaveBeenCalledWith(
        "appt-1",
        "New question for the doctor",
      );
    });
  });

  test("shows not-found when the appointment doesn't exist", async () => {
    appointmentsApi.getAppointments.mockResolvedValue([]);

    render(<AppointmentDetailPage user={mockUser} appointmentId="missing" />);

    expect(
      await screen.findByText("Appointment not found."),
    ).toBeInTheDocument();
  });
});
