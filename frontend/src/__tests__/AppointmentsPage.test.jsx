/*
 * AI-generated code: 30% (tool: ChatGPT; mock setup and render structure)
 * Human code: 70% (defined test cases, verified against actual AppointmentsPage behavior)
 */

import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import AppointmentsPage from "../AppointmentsPage";

jest.mock("../lib/appointmentsApi", () => ({
  appointmentsApi: {
    getAppointments: jest.fn(),
    cancelAppointment: jest.fn(),
  },
  apptToDisplayRow: jest.fn((appt) => ({
    id: appt.id,
    month: appt.appointment_date === "2099-12-31" ? "Dec" : "Jan",
    day: appt.appointment_date === "2099-12-31" ? "31" : "1",
    doctor: appt.provider_name,
    specialty: appt.specialty || "",
    date:
      appt.appointment_date === "2099-12-31"
        ? "December 31, 2099"
        : "January 1, 2020",
    time: appt.appointment_time === "09:30" ? "9:30 AM" : "10:00 AM",
    address: appt.location || "",
    status: appt.status,
    raw: appt,
  })),
}));

jest.mock("../lib/authApi", () => ({
  authApi: {
    signOut: jest.fn(),
  },
}));

import { appointmentsApi } from "../lib/appointmentsApi";

const mockUser = {
  email: "test@test.com",
  user_metadata: {
    first_name: "Stephanie",
    last_name: "Wang",
  },
};

const mockAppointments = [
  {
    id: "1",
    provider_name: "Dr. Emily Park",
    specialty: "Cardiology",
    location: "Boston Medical Center",
    appointment_date: "2099-12-31",
    appointment_time: "09:30",
    status: "scheduled",
    notes: null,
  },
  {
    id: "2",
    provider_name: "Dr. John Smith",
    specialty: "Primary Care",
    location: "Main Clinic",
    appointment_date: "2020-01-01",
    appointment_time: "10:00",
    status: "completed",
    notes: null,
  },
];

describe("AppointmentsPage", () => {
  beforeEach(() => {
    appointmentsApi.getAppointments.mockResolvedValue(mockAppointments);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("shows loading text before appointments load", async () => {
    render(
      <AppointmentsPage
        user={mockUser}
        onNavigate={jest.fn()}
        onSignOut={jest.fn()}
      />,
    );

    expect(screen.getByText("Loading appointments…")).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.queryByText("Loading appointments…"),
      ).not.toBeInTheDocument();
    });
  });
  test("shows appointment information after loading", async () => {
    render(
      <AppointmentsPage
        user={mockUser}
        onNavigate={jest.fn()}
        onSignOut={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Dr. Emily Park")).toBeInTheDocument();
    });

    expect(
      screen.getByText("Cardiology · Boston Medical Center"),
    ).toBeInTheDocument();
    expect(
      screen.getByText((content) => content.includes("9:30 AM")),
    ).toBeInTheDocument();
  });

  test("shows all appointments when All tab is selected", async () => {
    render(
      <AppointmentsPage
        user={mockUser}
        onNavigate={jest.fn()}
        onSignOut={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Dr. Emily Park")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("All"));

    await waitFor(() => {
      expect(screen.getByText("Dr. Emily Park")).toBeInTheDocument();
      expect(screen.getByText("Dr. John Smith")).toBeInTheDocument();
    });
  });
});
