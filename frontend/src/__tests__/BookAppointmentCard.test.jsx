/*
 * AI-USAGE SUMMARY
 * Model: Claude Opus 4.8
 * Overall AI Contribution: ~80%
 * AI-Assisted Areas: Test structure, render/click setup, and the stage payloads for BookAppointmentCard.
 * Human Contributions: Chose the cases that matter (confirm-stage one-tap booking, provider/time selection then confirm, the alternatives two-path layout, the 409/error retry, and the onNavigate hook after booking) and asserted the exact createAppointment args so a regression in the deterministic write path is caught.
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import BookAppointmentCard from "../pulse/cards/BookAppointmentCard";
import { appointmentsApi } from "../lib/appointmentsApi";

jest.mock("../lib/appointmentsApi", () => ({
  appointmentsApi: {
    createAppointment: jest.fn(),
  },
}));

beforeEach(() => {
  appointmentsApi.createAppointment.mockReset();
  appointmentsApi.createAppointment.mockResolvedValue({ id: "appt-1" });
});

const provider = { id: "p-smith", name: "Dr. Jane Smith", specialty: "Cardiology" };
const slot = { availability_id: "s-1", date: "2026-06-20", time: "09:00" };

describe("BookAppointmentCard — confirm stage", () => {
  const confirmPayload = {
    stage: "confirm",
    provider,
    slot,
    notes: "annual checkup",
  };

  test("opens straight into the confirmation step", () => {
    render(<BookAppointmentCard payload={confirmPayload} />);
    expect(screen.getByText("Confirm this appointment")).toBeInTheDocument();
    expect(screen.getByText("Dr. Jane Smith")).toBeInTheDocument();
    expect(screen.getByText(/Jun 20 · 9:00 AM/)).toBeInTheDocument();
    expect(screen.getByText("“annual checkup”")).toBeInTheDocument();
  });

  test("Confirm books with the exact provider + slot ids and notes", async () => {
    render(<BookAppointmentCard payload={confirmPayload} />);
    fireEvent.click(screen.getByText("Confirm"));
    await waitFor(() =>
      expect(appointmentsApi.createAppointment).toHaveBeenCalledWith({
        provider_id: "p-smith",
        availability_id: "s-1",
        notes: "annual checkup",
      }),
    );
    expect(await screen.findByText("Appointment booked")).toBeInTheDocument();
  });

  test("confirm stage has no Back button", () => {
    render(<BookAppointmentCard payload={confirmPayload} />);
    expect(screen.queryByText("Back")).not.toBeInTheDocument();
  });

  test("View my appointments fires onNavigate after booking", async () => {
    const onNavigate = jest.fn();
    render(<BookAppointmentCard payload={confirmPayload} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByText("Confirm"));
    const viewBtn = await screen.findByText("View my appointments");
    fireEvent.click(viewBtn);
    expect(onNavigate).toHaveBeenCalledWith("appointments");
  });

  test("a failed booking surfaces an inline retry", async () => {
    appointmentsApi.createAppointment.mockRejectedValueOnce(
      new Error("Appointment slot is already booked."),
    );
    render(<BookAppointmentCard payload={confirmPayload} />);
    fireEvent.click(screen.getByText("Confirm"));
    expect(
      await screen.findByText("Appointment slot is already booked."),
    ).toBeInTheDocument();
    expect(screen.getByText("Try again")).toBeInTheDocument();
  });
});

describe("BookAppointmentCard — choose_provider stage", () => {
  const payload = {
    stage: "choose_provider",
    options: [
      { provider, slot },
      {
        provider: { id: "p-jones", name: "Dr. Bob Jones", specialty: "Cardiology" },
        slot: { availability_id: "s-2", date: "2026-06-21", time: "10:00" },
      },
    ],
    requested: { date: null, time: null },
    notes: null,
  };

  test("lists each provider option", () => {
    render(<BookAppointmentCard payload={payload} />);
    expect(screen.getByText("Choose a provider")).toBeInTheDocument();
    expect(screen.getByText("Dr. Jane Smith")).toBeInTheDocument();
    expect(screen.getByText("Dr. Bob Jones")).toBeInTheDocument();
  });

  test("picking an option moves to confirm then books that option", async () => {
    render(<BookAppointmentCard payload={payload} />);
    fireEvent.click(screen.getByText("Dr. Bob Jones"));
    expect(screen.getByText("Confirm this appointment")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Confirm"));
    await waitFor(() =>
      expect(appointmentsApi.createAppointment).toHaveBeenCalledWith({
        provider_id: "p-jones",
        availability_id: "s-2",
        notes: null,
      }),
    );
  });

  test("Back returns to the option list", () => {
    render(<BookAppointmentCard payload={payload} />);
    fireEvent.click(screen.getByText("Dr. Jane Smith"));
    fireEvent.click(screen.getByText("Back"));
    expect(screen.getByText("Choose a provider")).toBeInTheDocument();
  });
});

describe("BookAppointmentCard — choose_time stage", () => {
  const payload = {
    stage: "choose_time",
    provider,
    slots: [
      { availability_id: "s-1", date: "2026-06-20", time: "09:00" },
      { availability_id: "s-3", date: "2026-06-20", time: "10:00" },
    ],
    notes: null,
  };

  test("lists the provider's times and books the picked one", async () => {
    render(<BookAppointmentCard payload={payload} />);
    expect(
      screen.getByText("Pick a time with Dr. Jane Smith"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Jun 20 · 10:00 AM/));
    fireEvent.click(screen.getByText("Confirm"));
    await waitFor(() =>
      expect(appointmentsApi.createAppointment).toHaveBeenCalledWith({
        provider_id: "p-smith",
        availability_id: "s-3",
        notes: null,
      }),
    );
  });
});

describe("BookAppointmentCard — alternatives stage", () => {
  const payload = {
    stage: "alternatives",
    provider,
    requested: { date: "2026-06-20", time: "14:00" },
    provider_slots: [{ availability_id: "s-1", date: "2026-06-20", time: "09:00" }],
    other_providers: [
      {
        provider: { id: "p-jones", name: "Dr. Bob Jones", specialty: "Cardiology" },
        slot: { availability_id: "s-9", date: "2026-06-20", time: "14:00" },
      },
    ],
    notes: null,
  };

  test("shows both the same-provider times and the other-provider options", () => {
    render(<BookAppointmentCard payload={payload} />);
    expect(
      screen.getByText("Other times with Dr. Jane Smith"),
    ).toBeInTheDocument();
    expect(screen.getByText("Other providers at 2:00 PM")).toBeInTheDocument();
    expect(screen.getByText("Dr. Bob Jones")).toBeInTheDocument();
  });

  test("picking a different time keeps the same provider", async () => {
    render(<BookAppointmentCard payload={payload} />);
    fireEvent.click(screen.getByText(/Jun 20 · 9:00 AM/));
    fireEvent.click(screen.getByText("Confirm"));
    await waitFor(() =>
      expect(appointmentsApi.createAppointment).toHaveBeenCalledWith({
        provider_id: "p-smith",
        availability_id: "s-1",
        notes: null,
      }),
    );
  });

  test("picking another provider books that provider's slot", async () => {
    render(<BookAppointmentCard payload={payload} />);
    fireEvent.click(screen.getByText("Dr. Bob Jones"));
    fireEvent.click(screen.getByText("Confirm"));
    await waitFor(() =>
      expect(appointmentsApi.createAppointment).toHaveBeenCalledWith({
        provider_id: "p-jones",
        availability_id: "s-9",
        notes: null,
      }),
    );
  });
});

describe("BookAppointmentCard — none stage", () => {
  test("renders the empty state", () => {
    render(<BookAppointmentCard payload={{ stage: "none", notes: null }} />);
    expect(
      screen.getByText("There are no open appointment slots to book right now."),
    ).toBeInTheDocument();
  });
});
