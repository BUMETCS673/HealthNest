/*
 * AI-USAGE SUMMARY
 * Model: Claude Opus 4.8
 * Overall AI Contribution: ~80%
 * AI-Assisted Areas: Test structure, render setup, and the react-markdown / child-card mocks for MessageBubble.
 * Human Contributions: Chose the cases that matter (user turns render as plain text without markdown, assistant turns render prose, the typing indicator appears mid-stream, and skill cards + citations render for assistant turns) and verified them against the actual MessageBubble. react-markdown is ESM, so it is mocked to a passthrough that renders its children as text.
 */

import { render, screen } from "@testing-library/react";
import MessageBubble from "../pulse/MessageBubble";

// react-markdown ships as ESM and isn't transformed by babel-jest; render the
// markdown source as plain text so we can still assert on the content.
jest.mock("react-markdown", () => ({ children }) => <div>{children}</div>);
jest.mock("../pulse/cards/AppointmentsCard", () => () => (
  <div data-testid="appointments-card" />
));
jest.mock("../pulse/cards/LabResultsCard", () => () => (
  <div data-testid="lab-results-card" />
));

describe("MessageBubble", () => {
  test("renders a user turn as plain text", () => {
    render(
      <MessageBubble
        message={{ id: "m1", role: "user", content: "When is my next visit?" }}
        isStreaming={false}
      />,
    );
    expect(screen.getByText("When is my next visit?")).toBeInTheDocument();
  });

  test("renders an assistant turn's prose content", () => {
    render(
      <MessageBubble
        message={{ id: "m2", role: "assistant", content: "Your next visit is Friday." }}
        isStreaming={false}
      />,
    );
    expect(screen.getByText("Your next visit is Friday.")).toBeInTheDocument();
  });

  test("shows the typing indicator for an empty streaming assistant turn", () => {
    render(
      <MessageBubble
        message={{ id: "m3", role: "assistant", content: "" }}
        isStreaming
      />,
    );
    expect(screen.getByLabelText("Pulse is thinking")).toBeInTheDocument();
  });

  test("renders skill cards attached to an assistant turn", () => {
    render(
      <MessageBubble
        message={{
          id: "m4",
          role: "assistant",
          content: "Here are your appointments.",
          skill_outputs: [{ skill: "get_appointments", payload: { appointments: [] } }],
        }}
        isStreaming={false}
      />,
    );
    expect(screen.getByTestId("appointments-card")).toBeInTheDocument();
  });

  test("renders citation chips when citations are present", () => {
    render(
      <MessageBubble
        message={{
          id: "m5",
          role: "assistant",
          content: "Based on your records.",
          citations: [{ source: "records", snippet: "appt" }],
        }}
        isStreaming={false}
      />,
    );
    expect(screen.getByText("Records")).toBeInTheDocument();
  });
});
