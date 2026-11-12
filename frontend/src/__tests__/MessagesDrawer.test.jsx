/*
AI-USAGE SUMMARY
Tools: Claude Code (Fable 5)
Overall AI Contribution: ~90%
AI-Assisted Areas: Wrote tests asserting the messages drawer renders without a
blocking scrim and the launcher shows while the drawer is closed.
Human Contributions: Requested that the Pulse and messages drawers be usable at
the same time.
*/

import React from "react";
import "@testing-library/jest-dom";
import { render, screen, cleanup } from "@testing-library/react";
import MessagesDrawer from "../messages/MessagesDrawer";

let mockMessagesState;

jest.mock("../messages/MessagesProvider", () => ({
  useMessages: () => mockMessagesState,
}));

beforeEach(() => {
  mockMessagesState = {
    drawerOpen: false,
    openDrawer: jest.fn(),
    closeDrawer: jest.fn(),
    contacts: [],
    activeContactId: null,
    thread: [],
    unreadCount: 0,
    unreadByContact: {},
    openThread: jest.fn(),
    closeThread: jest.fn(),
    send: jest.fn(),
  };
});

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

describe("MessagesDrawer", () => {
  test("shows the floating launcher while closed", () => {
    render(<MessagesDrawer myId="me-1" />);

    expect(
      screen.getByRole("button", { name: "Open messages" }),
    ).toBeInTheDocument();
  });

  test("does not render a blocking scrim while open", () => {
    mockMessagesState.drawerOpen = true;
    const { container } = render(<MessagesDrawer myId="me-1" />);

    // No scrim — the rest of the page (incl. the Pulse drawer) stays
    // clickable while messages are open.
    expect(container.querySelector(".msg-scrim")).toBeNull();
  });
});
