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
import PatientDashboard from "../patient/PatientDashboard";
import PulseProvider from "../pulse/PulseProvider";
import { appointmentsApi } from "../lib/appointmentsApi";

jest.mock("../lib/appointmentsApi", () => {
  const actual = jest.requireActual("../lib/appointmentsApi");
  return {
    ...actual,
    appointmentsApi: {
      ...actual.appointmentsApi,
      getAppointments: jest.fn().mockResolvedValue([]),
    },
  };
});

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

  test("upcoming appointment row opens that appointment's detail page", async () => {
    const onNavigate = jest.fn();
    appointmentsApi.getAppointments.mockResolvedValue([
      {
        id: "appt-1",
        status: "scheduled",
        provider_id: "prov-1",
        providers: {
          first_name: "Sam",
          last_name: "Lee",
          specialty: "cardiology",
        },
        provider_availability: {
          available_date: "2099-01-15",
          available_time: "09:30",
        },
      },
    ]);

    renderPatientDashboard({ onNavigate });

    const user = userEvent.setup();
    await user.click(await screen.findByText("Sam Lee"));

    expect(onNavigate).toHaveBeenCalledWith(
      "appointment-detail",
      expect.objectContaining({ appointmentId: "appt-1" }),
    );
  });

  test("view all link still opens the appointments list", async () => {
    const onNavigate = jest.fn();
    appointmentsApi.getAppointments.mockResolvedValue([]);

    renderPatientDashboard({ onNavigate });

    const user = userEvent.setup();
    // The appointments card renders first; meds/labs cards have their own.
    await user.click(screen.getAllByRole("button", { name: "View all" })[0]);

    expect(onNavigate).toHaveBeenCalledWith("appointments");
  });
});
