/*
 * AI-generated code: 30% (tool: ChatGPT; mock setup and render structure)
 * Human code: 70% (defined test cases, expected page behavior, and verified
 * against actual BookingPage behavior)
 */

import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import BookingPage from "../booking/BookingPage";
import { providersApi } from "../lib/appointmentsApi";

jest.mock("../lib/appointmentsApi", () => ({
  providersApi: {
    getCareTeam: jest.fn(),
    getProviders: jest.fn(),
  },
}));

jest.mock("../lib/authApi", () => ({
  authApi: {
    signOut: jest.fn(),
  },
}));

const mockUser = {
  email: "test@test.com",
  user_metadata: {
    first_name: "Stephanie",
    last_name: "Wang",
  },
};

const careTeamProvider = {
  id: "prov-emily",
  title: "Dr.",
  first_name: "Emily",
  last_name: "Park",
  specialty: "Cardiology",
};

const newProvider = {
  id: "prov-john",
  title: "Dr.",
  first_name: "John",
  last_name: "Smith",
  specialty: "Primary Care",
};

describe("BookingPage", () => {
  beforeEach(() => {
    providersApi.getCareTeam.mockResolvedValue([]);
    providersApi.getProviders.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("shows loading text before booking data loads", async () => {
    render(
      <BookingPage
        user={mockUser}
        onNavigate={jest.fn()}
        onSignOut={jest.fn()}
      />,
    );

    expect(screen.getByText("Loading…")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
    });
  });

  test("shows the Your Doctors section when the patient has a care team", async () => {
    providersApi.getCareTeam.mockResolvedValue([careTeamProvider]);

    render(
      <BookingPage
        user={mockUser}
        onNavigate={jest.fn()}
        onSignOut={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Your Doctors")).toBeInTheDocument();
    });

    expect(screen.getByText("Dr. Emily Park")).toBeInTheDocument();
  });

  test("shows the Find a New Doctor button when the patient has a care team", async () => {
    providersApi.getCareTeam.mockResolvedValue([careTeamProvider]);

    render(
      <BookingPage
        user={mockUser}
        onNavigate={jest.fn()}
        onSignOut={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Find a New Doctor")).toBeInTheDocument();
    });
  });

  test("shows new providers after Find a New Doctor is clicked", async () => {
    providersApi.getCareTeam.mockResolvedValue([careTeamProvider]);
    providersApi.getProviders.mockResolvedValue([newProvider]);

    render(
      <BookingPage
        user={mockUser}
        onNavigate={jest.fn()}
        onSignOut={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Find a New Doctor")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Find a New Doctor"));

    await waitFor(() => {
      expect(screen.getByText("Dr. John Smith")).toBeInTheDocument();
    });
  });
});
