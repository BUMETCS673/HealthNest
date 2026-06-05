/*
 * AI-USAGE SUMMARY
 * Model: Claude Opus 4.8
 * Overall AI Contribution: ~80%
 * AI-Assisted Areas: Test structure, render/click setup, and the sample appointment payloads for AppointmentsCard.
 * Human Contributions: Chose the cases that matter (filter-driven heading, row rendering with formatted date/time, the empty state, and the onNavigate('appointments') hook) and verified the formatted values against the actual card.
 */

import { render, screen, fireEvent } from "@testing-library/react";
import AppointmentsCard from "../pulse/cards/AppointmentsCard";

const appointment = {
  id: "a1",
  provider_name: "Dr. Taylor Smith",
  specialty: "Primary Care",
  appointment_date: "2026-06-20",
  appointment_time: "14:30",
  status: "scheduled",
};

describe("AppointmentsCard", () => {
  test("shows the upcoming heading by default", () => {
    render(<AppointmentsCard payload={{ appointments: [] }} />);
    expect(screen.getByText("Your upcoming appointments")).toBeInTheDocument();
  });

  test("shows the next-appointment heading for the 'next' filter", () => {
    render(<AppointmentsCard payload={{ filter: "next", appointments: [] }} />);
    expect(screen.getByText("Your next appointment")).toBeInTheDocument();
  });

  test("shows the past heading for the 'past' filter", () => {
    render(<AppointmentsCard payload={{ filter: "past", appointments: [] }} />);
    expect(screen.getByText("Past appointments")).toBeInTheDocument();
  });

  test("renders the empty state with no appointments", () => {
    render(<AppointmentsCard payload={{ appointments: [] }} />);
    expect(screen.getByText("No appointments to show.")).toBeInTheDocument();
  });

  test("renders an appointment row with provider, specialty and 12h time", () => {
    render(<AppointmentsCard payload={{ appointments: [appointment] }} />);
    expect(screen.getByText("Dr. Taylor Smith")).toBeInTheDocument();
    expect(screen.getByText("· Primary Care")).toBeInTheDocument();
    expect(screen.getByText("2:30 PM")).toBeInTheDocument();
  });

  test("renders the date pill from the appointment date", () => {
    render(<AppointmentsCard payload={{ appointments: [appointment] }} />);
    expect(screen.getByText("Jun")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
  });

  test("fires onNavigate('appointments') from the Open link", () => {
    const onNavigate = jest.fn();
    render(
      <AppointmentsCard
        payload={{ appointments: [] }}
        onNavigate={onNavigate}
      />,
    );
    fireEvent.click(screen.getByText("Open"));
    expect(onNavigate).toHaveBeenCalledWith("appointments");
  });
});
