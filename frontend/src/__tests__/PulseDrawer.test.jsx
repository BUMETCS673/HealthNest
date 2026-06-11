/*
AI-USAGE SUMMARY
Tools: Claude Code (Fable 5)
Overall AI Contribution: ~90%
AI-Assisted Areas: Wrote tests for the global Pulse floating launcher (shown by
default, opens the drawer, hidden via hideLauncher and while the drawer is open).
Human Contributions: Reported that the Pulse shortcut was missing outside the
dashboard and records pages.
*/

import React from "react";
import "@testing-library/jest-dom";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PulseDrawer from "../pulse/PulseDrawer";

const mockOpenDrawer = jest.fn();

let mockPulseState;

jest.mock("../pulse/PulseProvider", () => ({
  usePulse: () => mockPulseState,
}));

jest.mock("../pulse/ConversationThread", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("../pulse/Composer", () => ({
  __esModule: true,
  default: () => null,
}));

beforeEach(() => {
  mockPulseState = {
    drawerOpen: false,
    openDrawer: mockOpenDrawer,
    closeDrawer: jest.fn(),
    messages: [],
    streaming: false,
    streamingId: null,
    send: jest.fn(),
    error: null,
    newConversation: jest.fn(),
  };
});

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

describe("PulseDrawer launcher", () => {
  test("shows the floating launcher and opens the drawer on click", async () => {
    const user = userEvent.setup();
    render(<PulseDrawer />);

    const fab = screen.getByRole("button", { name: "Open Pulse AI" });
    await user.click(fab);

    expect(mockOpenDrawer).toHaveBeenCalledTimes(1);
  });

  test("hides the launcher when hideLauncher is set", () => {
    render(<PulseDrawer hideLauncher />);

    expect(
      screen.queryByRole("button", { name: "Open Pulse AI" }),
    ).not.toBeInTheDocument();
  });

  test("hides the launcher while the drawer is open", () => {
    mockPulseState.drawerOpen = true;
    render(<PulseDrawer />);

    expect(
      screen.queryByRole("button", { name: "Open Pulse AI" }),
    ).not.toBeInTheDocument();
  });

  test("does not render a blocking scrim while open", () => {
    mockPulseState.drawerOpen = true;
    const { container } = render(<PulseDrawer />);

    // No scrim — the rest of the page (incl. the messages drawer) stays
    // clickable while Pulse is open.
    expect(container.querySelector(".pulse-scrim")).toBeNull();
  });
});
