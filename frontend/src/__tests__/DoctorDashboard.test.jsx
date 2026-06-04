/*
AI-USAGE SUMMARY
Tools: ChatGPT
Overall AI Contribution: ~60%
AI-Assisted Areas: Helped draft Jest tests for the Doctor Dashboard page,
including test setup, dashboard rendering checks, summary card checks,
schedule content checks, unsigned encounter
checks, patient alert checks, and profile sign-out interaction testing.
Human Contributions: Reviewed the Doctor Dashboard branch structure, adjusted
queries to match the actual DoctorDashboard component, fixed duplicate text
assertions, verified expected UI text, and ran the tests locally.
*/

import React from "react";
import "@testing-library/jest-dom";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DoctorDashboard from "../DoctorDashboard";

afterEach(() => {
  cleanup();
});

const mockDoctorUser = {
  email: "doctor@healthnest.com",
  user_metadata: {
    first_name: "Stephanie",
    last_name: "Wang",
    specialty: "cardiology",
    role: "provider",
  },
};

describe("DoctorDashboard", () => {
  test("renders the doctor dashboard navigation and greeting", () => {
    render(<DoctorDashboard user={mockDoctorUser} />);

    expect(screen.getAllByText("HealthNest").length).toBeGreaterThan(0);

    // Nav buttons appear in both nav and footer — use getAllByRole
    expect(
      screen.getAllByRole("button", { name: "Dashboard" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("button", { name: "Schedule" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("button", { name: "Patient Records" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("button", { name: "Messages" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("button", { name: "Pulse AI" }).length,
    ).toBeGreaterThan(0);

    expect(screen.getAllByText(/Stephanie/).length).toBeGreaterThan(0);
    expect(screen.getByText("Cardiology")).toBeInTheDocument();
  });

  test("shows the dashboard summary cards with correct counts", () => {
    render(<DoctorDashboard user={mockDoctorUser} />);

    expect(screen.getByText("Today's Patients")).toBeInTheDocument();
    expect(screen.getByText("7 scheduled")).toBeInTheDocument();
    expect(screen.getByText("3 seen · 4 pending")).toBeInTheDocument();

    // "Unsigned Encounters" appears in stat bar and card header
    expect(screen.getAllByText("Unsigned Encounters").length).toBeGreaterThan(
      0,
    );
    expect(screen.getByText("3 notes")).toBeInTheDocument();
    expect(screen.getByText("1 urgent")).toBeInTheDocument();

    expect(screen.getByText("Clinical Alerts")).toBeInTheDocument();
    // "3 active" appears in stat bar and alerts card header
    expect(screen.getAllByText("3 active").length).toBeGreaterThan(0);
    expect(screen.getByText("2 critical")).toBeInTheDocument();
  });

  test("renders today's schedule appointments", () => {
    render(<DoctorDashboard user={mockDoctorUser} />);

    expect(screen.getByText("Today's Schedule")).toBeInTheDocument();
    expect(screen.getByText("8:00 AM")).toBeInTheDocument();
    expect(screen.getAllByText("Robert Kim").length).toBeGreaterThan(0);
    expect(screen.getByText("Initial Consult")).toBeInTheDocument();

    expect(screen.getByText("9:30 AM")).toBeInTheDocument();
    expect(screen.getAllByText("Jennifer Lee").length).toBeGreaterThan(0);
    expect(screen.getByText("Medication Review")).toBeInTheDocument();
    expect(screen.getByText("Now")).toBeInTheDocument();

    expect(screen.getByText("11:30 AM")).toBeInTheDocument();
    expect(screen.getByText("James Martinez")).toBeInTheDocument();
    expect(screen.getByText("New Patient")).toBeInTheDocument();
  });

  test("renders AI pre-visit summaries", () => {
    render(<DoctorDashboard user={mockDoctorUser} />);

    // Appears in both stat area and card header
    expect(
      screen.getAllByText("AI Pre-Visit Summaries").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText("Generated from records, labs, and prior notes"),
    ).toBeInTheDocument();

    expect(screen.getAllByText("Jennifer Lee").length).toBeGreaterThan(0);
    expect(screen.getByText("Drug interaction")).toBeInTheDocument();

    // Thomas Brown appears in both schedule and AI summaries
    expect(screen.getAllByText("Thomas Brown").length).toBeGreaterThan(0);
    expect(screen.getByText("Holter pending")).toBeInTheDocument();

    // Amanda Clark appears in both schedule and AI summaries
    expect(screen.getAllByText("Amanda Clark").length).toBeGreaterThan(0);
    expect(screen.getByText("Borderline stress test")).toBeInTheDocument();

    expect(screen.getAllByText("Patricia Wang").length).toBeGreaterThan(0);
    expect(screen.getByText("Lab pending")).toBeInTheDocument();
    expect(screen.getByText("Weight gain")).toBeInTheDocument();
  });

  test("renders unsigned encounters and patient alerts", () => {
    render(<DoctorDashboard user={mockDoctorUser} />);

    expect(screen.getAllByText("Unsigned Encounters").length).toBeGreaterThan(
      0,
    );
    // Appears in both card subtitle and possibly elsewhere
    expect(
      screen.getAllByText("Notes pending your signature").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("Initial Consult · May 14")).toBeInTheDocument();
    expect(screen.getByText("Follow-up Note · May 14")).toBeInTheDocument();
    expect(screen.getByText("ECG Review Summary · May 13")).toBeInTheDocument();

    expect(screen.getByText("Patient Alerts")).toBeInTheDocument();
    expect(
      screen.getByText("Blood pressure 158/94 — flagged high"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Potential interaction: Warfarin + Aspirin"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Lab results pending review — CBC ordered 3 days ago"),
    ).toBeInTheDocument();
  });

  test("opens profile menu and calls sign out", async () => {
    const user = userEvent.setup();
    const onSignOut = jest.fn();

    render(<DoctorDashboard user={mockDoctorUser} onSignOut={onSignOut} />);

    // Find the profile button specifically by aria-haspopup attribute
    const profileButton = screen
      .getAllByRole("button")
      .find((btn) => btn.getAttribute("aria-haspopup") === "menu");
    expect(profileButton).toBeTruthy();
    await user.click(profileButton);

    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /Account Settings/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: /Sign out/i }));

    expect(onSignOut).toHaveBeenCalledTimes(1);
  });
});
