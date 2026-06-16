/*
 * AI-generated code: 30% (tool: ChatGPT; mock setup and render structure)
 * Human code: 70% (defined test cases, verified against actual AppointmentModal behavior)
 */

import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import AppointmentModal from "../appointments/AppointmentModal";
import { appointmentsApi } from "../lib/appointmentsApi";

jest.mock("../lib/appointmentsApi", () => ({
  appointmentsApi: {
    getAvailability: jest.fn(),
    createAppointment: jest.fn(),
    rescheduleAppointment: jest.fn(),
  },
  formatApptDate: jest.fn((date) => `Formatted: ${date}`),
  formatApptTime: jest.fn((time) => {
    if (time === "09:30") {
      return "9:30 AM";
    }

    if (time === "14:00") {
      return "2:00 PM";
    }

    return time;
  }),
}));

const mockSlots = [
  {
    id: "slot-1",
    provider_id: "prov-1",
    available_date: "2026-06-20",
    available_time: "09:30",
    is_booked: false,
    providers: {
      first_name: "Emily",
      last_name: "Park",
      specialty: "Cardiology",
    },
  },
  {
    id: "slot-2",
    provider_id: "prov-1",
    available_date: "2026-06-20",
    available_time: "14:00",
    is_booked: false,
    providers: {
      first_name: "Emily",
      last_name: "Park",
      specialty: "Cardiology",
    },
  },
];

describe("AppointmentModal", () => {
  beforeEach(() => {
    appointmentsApi.getAvailability.mockResolvedValue([]);
    appointmentsApi.createAppointment.mockResolvedValue({});
    appointmentsApi.rescheduleAppointment.mockResolvedValue({});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("shows loading state initially", async () => {
    render(
      <AppointmentModal
        onClose={jest.fn()}
        onBooked={jest.fn()}
        providerId="prov-1"
      />,
    );

    expect(screen.getByText("Loading available slots…")).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.queryByText("Loading available slots…"),
      ).not.toBeInTheDocument();
    });
  });

  test("shows no slots message when provider has no availability", async () => {
    render(
      <AppointmentModal
        onClose={jest.fn()}
        onBooked={jest.fn()}
        providerId="prov-1"
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText("No available slots for this provider."),
      ).toBeInTheDocument();
    });
  });

  test("shows available time slots for the provider", async () => {
    appointmentsApi.getAvailability.mockResolvedValue(mockSlots);

    render(
      <AppointmentModal
        onClose={jest.fn()}
        onBooked={jest.fn()}
        providerId="prov-1"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("9:30 AM")).toBeInTheDocument();
    });

    expect(screen.getByText("2:00 PM")).toBeInTheDocument();
  });

  test("shows Book an Appointment title by default", async () => {
    render(
      <AppointmentModal
        onClose={jest.fn()}
        onBooked={jest.fn()}
        providerId="prov-1"
      />,
    );

    expect(screen.getByText("Book an Appointment")).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.queryByText("Loading available slots…"),
      ).not.toBeInTheDocument();
    });
  });

  test("shows Reschedule Appointment title when rescheduleId is provided", async () => {
    render(
      <AppointmentModal
        onClose={jest.fn()}
        onBooked={jest.fn()}
        providerId="prov-1"
        rescheduleId="appt-1"
      />,
    );

    expect(screen.getByText("Reschedule Appointment")).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.queryByText("Loading available slots…"),
      ).not.toBeInTheDocument();
    });
  });

  test("calls onClose when close button is clicked", async () => {
    const onClose = jest.fn();

    render(
      <AppointmentModal
        onClose={onClose}
        onBooked={jest.fn()}
        providerId="prov-1"
      />,
    );

    await waitFor(() => {
      expect(
        screen.queryByText("Loading available slots…"),
      ).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Close"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
