/*
 * AI-USAGE SUMMARY
 * Model: Claude Opus 4.8
 * Overall AI Contribution: ~80%
 * AI-Assisted Areas: Test structure, render/click setup, and the relative-timestamp fixtures for ConversationSidebar.
 * Human Contributions: Chose the cases that matter (title fallback chain, active-row marking, New chat + select callbacks, empty state, and the relative "Xm/Xh ago" formatting) and built the timestamps as offsets from the current time so the relative-time assertions don't go stale.
 */

import { render, screen, fireEvent } from "@testing-library/react";
import ConversationSidebar from "../pulse/ConversationSidebar";

function isoSecondsAgo(seconds) {
  return new Date(Date.now() - seconds * 1000).toISOString();
}

describe("ConversationSidebar", () => {
  const baseProps = {
    activeId: null,
    onSelect: jest.fn(),
    onNew: jest.fn(),
  };

  afterEach(() => jest.clearAllMocks());

  test("shows the empty state when there are no conversations", () => {
    render(<ConversationSidebar {...baseProps} conversations={[]} />);
    expect(screen.getByText("No prior chats yet.")).toBeInTheDocument();
  });

  test("calls onNew when the New chat button is clicked", () => {
    const onNew = jest.fn();
    render(
      <ConversationSidebar {...baseProps} onNew={onNew} conversations={[]} />,
    );
    fireEvent.click(screen.getByText("New chat"));
    expect(onNew).toHaveBeenCalledTimes(1);
  });

  test("uses the conversation title when present", () => {
    render(
      <ConversationSidebar
        {...baseProps}
        conversations={[{ id: "c1", title: "My labs", started_at: isoSecondsAgo(10) }]}
      />,
    );
    expect(screen.getByText("My labs")).toBeInTheDocument();
  });

  test("falls back to the last message preview when there is no title", () => {
    render(
      <ConversationSidebar
        {...baseProps}
        conversations={[
          {
            id: "c1",
            title: "  ",
            last_message_preview: "When is my appointment",
            started_at: isoSecondsAgo(10),
          },
        ]}
      />,
    );
    expect(screen.getByText("When is my appointment")).toBeInTheDocument();
  });

  test("falls back to 'New conversation' with no title or preview", () => {
    render(
      <ConversationSidebar
        {...baseProps}
        conversations={[{ id: "c1", started_at: isoSecondsAgo(10) }]}
      />,
    );
    expect(screen.getByText("New conversation")).toBeInTheDocument();
  });

  test("calls onSelect with the conversation id when a row is clicked", () => {
    const onSelect = jest.fn();
    render(
      <ConversationSidebar
        {...baseProps}
        onSelect={onSelect}
        conversations={[{ id: "c1", title: "Chat", started_at: isoSecondsAgo(10) }]}
      />,
    );
    fireEvent.click(screen.getByText("Chat"));
    expect(onSelect).toHaveBeenCalledWith("c1");
  });

  test("marks the active conversation row", () => {
    render(
      <ConversationSidebar
        {...baseProps}
        activeId="c1"
        conversations={[{ id: "c1", title: "Active chat", started_at: isoSecondsAgo(10) }]}
      />,
    );
    const row = screen.getByText("Active chat").closest("button");
    expect(row.className).toContain("pulse-sidebar-row--active");
  });

  test("formats a recent timestamp as 'just now'", () => {
    render(
      <ConversationSidebar
        {...baseProps}
        conversations={[
          { id: "c1", title: "Chat", last_message_at: isoSecondsAgo(5) },
        ]}
      />,
    );
    expect(screen.getByText("just now")).toBeInTheDocument();
  });

  test("formats minutes and hours ago", () => {
    render(
      <ConversationSidebar
        {...baseProps}
        conversations={[
          { id: "c1", title: "Minutes", last_message_at: isoSecondsAgo(120) },
          { id: "c2", title: "Hours", last_message_at: isoSecondsAgo(7200) },
        ]}
      />,
    );
    expect(screen.getByText("2m ago")).toBeInTheDocument();
    expect(screen.getByText("2h ago")).toBeInTheDocument();
  });
});
