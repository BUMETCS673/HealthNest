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
import DoctorDashboard from "../doctor/DoctorDashboard";
import DfaProvider from "../pulse/DfaProvider";

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
    render(
      <DfaProvider>
        <DoctorDashboard user={mockDoctorUser} />
      </DfaProvider>,
    );
    expect(screen.getAllByText("HealthNest").length).toBeGreaterThan(0);

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

  test("shows the dashboard summary cards", () => {
    render(
      <DfaProvider>
        <DoctorDashboard user={mockDoctorUser} />
      </DfaProvider>,
    );

    expect(screen.getByText("Today's Patients")).toBeInTheDocument();
    expect(screen.getAllByText("Unsigned Encounters").length).toBeGreaterThan(
      0,
    );
    expect(screen.getByText("Clinical Alerts")).toBeInTheDocument();
  });

  test("renders today's schedule section", () => {
    render(
      <DfaProvider>
        <DoctorDashboard user={mockDoctorUser} />
      </DfaProvider>,
    );

    expect(screen.getByText("Today's Schedule")).toBeInTheDocument();
  });

  test("renders AI pre-visit summaries section", () => {
    render(
      <DfaProvider>
        <DoctorDashboard user={mockDoctorUser} />
      </DfaProvider>,
    );

    expect(
      screen.getAllByText("AI Pre-Visit Summaries").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText("Generated from records, labs, and prior notes"),
    ).toBeInTheDocument();
  });

  test("renders unsigned encounters and patient alerts sections", () => {
    render(
      <DfaProvider>
        <DoctorDashboard user={mockDoctorUser} />
      </DfaProvider>,
    );

    expect(screen.getAllByText("Unsigned Encounters").length).toBeGreaterThan(
      0,
    );
    expect(
      screen.getAllByText("Notes pending your signature").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("Patient Alerts")).toBeInTheDocument();
  });

  test("opens profile menu and calls sign out", async () => {
    const user = userEvent.setup();
    const onSignOut = jest.fn();

    render(
      <DfaProvider>
        <DoctorDashboard user={mockDoctorUser} onSignOut={onSignOut} />
      </DfaProvider>,
    );

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
