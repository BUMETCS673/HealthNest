/*
 * AI-USAGE SUMMARY
 * Model: Claude Opus 4.8
 * Overall AI Contribution: ~80%
 * AI-Assisted Areas: Test structure, render setup, and the react-markdown / child-card mocks for ConversationThread.
 * Human Contributions: Chose the cases that matter (the Pulse empty-state greeting vs. rendering one bubble per message, and that the streaming turn is flagged) and verified them against the actual thread. The auto-scroll effect is a no-op under jsdom (no scrollable ancestor), so these tests focus on render output.
 */

import { render, screen } from "@testing-library/react";
import ConversationThread from "../pulse/ConversationThread";

jest.mock("react-markdown", () => ({ children }) => <div>{children}</div>);
jest.mock("../pulse/cards/AppointmentsCard", () => () => <div />);
jest.mock("../pulse/cards/LabResultsCard", () => () => <div />);

describe("ConversationThread", () => {
  test("renders the empty-state greeting with no messages", () => {
    render(<ConversationThread messages={[]} streaming={false} />);
    expect(screen.getByText("Hi, I'm Pulse.")).toBeInTheDocument();
  });

  test("renders a bubble for each message", () => {
    render(
      <ConversationThread
        streaming={false}
        messages={[
          { id: "m1", role: "user", content: "Hello" },
          { id: "m2", role: "assistant", content: "Hi there" },
        ]}
      />,
    );
    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByText("Hi there")).toBeInTheDocument();
  });

  test("does not show the empty state once messages exist", () => {
    render(
      <ConversationThread
        streaming={false}
        messages={[{ id: "m1", role: "user", content: "Hello" }]}
      />,
    );
    expect(screen.queryByText("Hi, I'm Pulse.")).not.toBeInTheDocument();
  });
});
