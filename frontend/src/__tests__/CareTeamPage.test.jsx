/*
 * AI-generated code: 75% (tool: Claude Code / Opus 4.8; mock setup and render
 * structure)
 * Human code: 25% (defined test cases and verified against actual CareTeamPage
 * behavior)
 */

import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import CareTeamPage from "../careteam/CareTeamPage";
import { providersApi } from "../lib/appointmentsApi";

jest.mock("../lib/appointmentsApi", () => ({
  appointmentsApi: {
    getAvailability: jest.fn(),
    getAppointments: jest.fn(),
  },
  providersApi: {
    getCareTeam: jest.fn(),
  },
}));

jest.mock("../lib/authApi", () => ({
  authApi: { signOut: jest.fn() },
}));

const mockUser = {
  email: "test@test.com",
  user_metadata: { first_name: "Stephanie", last_name: "Wang" },
};

const careTeamProvider = {
  id: "prov-emily",
  user_id: "user-emily",
  title: "Dr.",
  first_name: "Emily",
  last_name: "Park",
  specialty: "Cardiology",
  status: "active",
};

describe("CareTeamPage", () => {
  afterEach(() => jest.clearAllMocks());

  test("shows loading text before the care team loads", async () => {
    providersApi.getCareTeam.mockResolvedValue([]);

    render(
      <CareTeamPage user={mockUser} onNavigate={jest.fn()} onSignOut={jest.fn()} />,
    );

    expect(screen.getByText("Loading your care team…")).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.queryByText("Loading your care team…"),
      ).not.toBeInTheDocument(),
    );
  });

  test("renders the patient's care-team providers", async () => {
    providersApi.getCareTeam.mockResolvedValue([careTeamProvider]);

    render(
      <CareTeamPage user={mockUser} onNavigate={jest.fn()} onSignOut={jest.fn()} />,
    );

    await waitFor(() =>
      expect(screen.getByText("Dr. Emily Park")).toBeInTheDocument(),
    );
    expect(screen.getByText("Cardiology")).toBeInTheDocument();
  });

  test("shows the empty state when there are no care-team members", async () => {
    providersApi.getCareTeam.mockResolvedValue([]);

    render(
      <CareTeamPage user={mockUser} onNavigate={jest.fn()} onSignOut={jest.fn()} />,
    );

    await waitFor(() =>
      expect(
        screen.getByText("You don't have any care team members yet."),
      ).toBeInTheDocument(),
    );
  });

  test("Find a Doctor (empty state) navigates to booking", async () => {
    providersApi.getCareTeam.mockResolvedValue([]);
    const onNavigate = jest.fn();

    render(
      <CareTeamPage user={mockUser} onNavigate={onNavigate} onSignOut={jest.fn()} />,
    );

    await waitFor(() =>
      expect(screen.getByText("Find a Doctor")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByText("Find a Doctor"));
    expect(onNavigate).toHaveBeenCalledWith("booking");
  });

  test("Message action opens that provider's message thread", async () => {
    providersApi.getCareTeam.mockResolvedValue([careTeamProvider]);
    const onNavigate = jest.fn();

    render(
      <CareTeamPage user={mockUser} onNavigate={onNavigate} onSignOut={jest.fn()} />,
    );

    await waitFor(() =>
      expect(screen.getByText("Dr. Emily Park")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByText("Message"));
    expect(onNavigate).toHaveBeenCalledWith("messages", {
      openContactId: "user-emily",
    });
  });
});
