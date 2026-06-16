/*
AI-USAGE SUMMARY
Tools: Claude Code (Fable 5)
Overall AI Contribution: ~90%
AI-Assisted Areas: Wrote tests for the MessagesView initialContactId deep-link
prop (opens the conversation on mount, no-op when absent).
Human Contributions: Requested the Message-button deep link from the patient
chart and reviewed the expected behavior.
*/

import React from "react";
import "@testing-library/jest-dom";
import { render, cleanup, waitFor } from "@testing-library/react";
import MessagesView from "../messages/MessagesView";

const mockOpenThread = jest.fn();
const mockLoadContacts = jest.fn();

jest.mock("../messages/MessagesProvider", () => ({
  useMessages: () => ({
    contacts: [],
    activeContactId: null,
    thread: [],
    unreadByContact: {},
    openThread: mockOpenThread,
    closeThread: jest.fn(),
    send: jest.fn(),
    loadContacts: mockLoadContacts,
  }),
}));

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

describe("MessagesView", () => {
  test("opens the conversation for initialContactId on mount", async () => {
    render(<MessagesView myId="me-1" initialContactId="peer-9" />);

    await waitFor(() => {
      expect(mockOpenThread).toHaveBeenCalledWith("peer-9");
    });
  });

  test("does not open a conversation without initialContactId", () => {
    render(<MessagesView myId="me-1" />);

    expect(mockOpenThread).not.toHaveBeenCalled();
    expect(mockLoadContacts).toHaveBeenCalled();
  });
});
