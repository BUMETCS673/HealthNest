/*
 * AI-generated code: 30% (tool: ChatGPT; mock setup and render structure)
 * Human code: 70% (defined test cases, verified against actual AppointmentsPage behavior)
 */

import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import AppointmentsPage from "../appointments/AppointmentsPage";

jest.mock("../lib/appointmentsApi", () => ({
  appointmentsApi: {
    getAppointments: jest.fn(),
    cancelAppointment: jest.fn(),
  },
  apptToDisplayRow: jest.fn((appt) => ({
    id: appt.id,
    month:
      appt.provider_availability.available_date === "2099-12-31"
        ? "Dec"
        : "Jan",
    day:
      appt.provider_availability.available_date === "2099-12-31" ? "31" : "1",
    doctor: `${appt.providers.first_name} ${appt.providers.last_name}`,
    specialty: appt.providers.specialty || "",
    date:
      appt.provider_availability.available_date === "2099-12-31"
        ? "December 31, 2099"
        : "January 1, 2020",
    time:
      appt.provider_availability.available_time === "09:30"
        ? "9:30 AM"
        : "10:00 AM",
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
    provider_id: "prov-emily",
    status: "scheduled",
    notes: null,
    providers: {
      first_name: "Emily",
      last_name: "Park",
      specialty: "Cardiology",
    },
    provider_availability: {
      available_date: "2099-12-31",
      available_time: "09:30",
    },
  },
  {
    id: "2",
    provider_id: "prov-john",
    status: "completed",
    notes: null,
    providers: {
      first_name: "John",
      last_name: "Smith",
      specialty: "Primary Care",
    },
    provider_availability: {
      available_date: "2020-01-01",
      available_time: "10:00",
    },
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
      expect(screen.getByText("Emily Park")).toBeInTheDocument();
    });

    expect(screen.getAllByText("Cardiology").length).toBeGreaterThan(0);

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
      expect(screen.getByText("Emily Park")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("All"));

    await waitFor(() => {
      expect(screen.getByText("Emily Park")).toBeInTheDocument();
      expect(screen.getByText("John Smith")).toBeInTheDocument();
    });
  });

  test("footer logo navigates back to the dashboard", async () => {
    const onNavigate = jest.fn();
    const { container } = render(
      <AppointmentsPage
        user={mockUser}
        onNavigate={onNavigate}
        onSignOut={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Emily Park")).toBeInTheDocument();
    });

    fireEvent.click(container.querySelector("footer .ap-logo"));

    expect(onNavigate).toHaveBeenCalledWith("dashboard");
  });
});
