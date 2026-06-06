/*
AI-USAGE SUMMARY
Tools: ChatGPT
Overall AI Contribution: ~40%
AI-Assisted Areas: Helped draft Jest tests for the Patient Dashboard page,
including dashboard rendering checks, navigation checks, section checks,
and profile sign-out interaction testing.
Human Contributions: Reviewed the Patient Dashboard branch structure, adjusted
queries to match the actual PatientDashboard component, avoided personal test data,
verified expected UI text, and ran the tests locally.
*/

import React from "react";
import "@testing-library/jest-dom";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PatientDashboard from "../PatientDashboard";
import PulseProvider from "../pulse/PulseProvider";

afterEach(() => {
  cleanup();
});

const mockPatientUser = {
  email: "patient@healthnest.com",
  user_metadata: {
    first_name: "Alex",
    last_name: "Morgan",
    role: "patient",
  },
};

function renderPatientDashboard(props = {}) {
  return render(
    <PulseProvider>
      <PatientDashboard user={mockPatientUser} {...props} />
    </PulseProvider>,
  );
}

describe("PatientDashboard", () => {
  test("renders the patient dashboard navigation and greeting", () => {
    renderPatientDashboard();

    expect(screen.getAllByText("HealthNest").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Alex/).length).toBeGreaterThan(0);
  });

  test("renders main patient dashboard sections", () => {
    renderPatientDashboard();

    expect(screen.getAllByText(/Dashboard/i).length).toBeGreaterThan(0);
  });

  test("opens profile menu and calls sign out", async () => {
    const user = userEvent.setup();
    const onSignOut = jest.fn();

    renderPatientDashboard({ onSignOut });

    const profileButton = screen
      .getAllByRole("button")
      .find((btn) => btn.getAttribute("aria-haspopup") === "menu");

    expect(profileButton).toBeTruthy();

    await user.click(profileButton);

    expect(screen.getByRole("menu")).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: /Sign out/i }));

    expect(onSignOut).toHaveBeenCalledTimes(1);
  });
});
