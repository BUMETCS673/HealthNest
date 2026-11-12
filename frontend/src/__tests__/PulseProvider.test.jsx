/*
 * AI-USAGE SUMMARY
 * Model: Claude Opus 4.8
 * Overall AI Contribution: ~80%
 * AI-Assisted Areas: Test structure, the pulseApi mock, and the small test consumer that surfaces the usePulse context for assertions.
 * Human Contributions: Chose the cases that matter (mount loads conversations, send opens a conversation then optimistically appends the user + assistant turns, streamed deltas accumulate into the assistant turn, onDone clears the streaming flag, onError surfaces the message, and blank/whitespace sends are ignored) and verified them against the actual optimistic-message lifecycle.
 */

import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import PulseProvider, { usePulse } from "../pulse/PulseProvider";
import { pulseApi } from "../lib/pulseApi";

jest.mock("../lib/pulseApi", () => ({
  pulseApi: {
    listConversations: jest.fn(),
    createConversation: jest.fn(),
    getConversation: jest.fn(),
    deleteConversation: jest.fn(),
    streamMessage: jest.fn(),
  },
}));

function Consumer() {
  const { messages, streaming, error, send, newConversation } = usePulse();
  return (
    <div>
      <span data-testid="streaming">{String(streaming)}</span>
      <span data-testid="error">{error || ""}</span>
      <span data-testid="count">{messages.length}</span>
      <ul>
        {messages.map((m) => (
          <li key={m.id} data-testid={`msg-${m.role}`}>
            {m.content}
          </li>
        ))}
      </ul>
      <button onClick={() => send("Hello Pulse")}>send</button>
      <button onClick={() => send("   ")}>send-blank</button>
      <button onClick={() => newConversation()}>new</button>
    </div>
  );
}

function renderProvider() {
  return render(
    <PulseProvider>
      <Consumer />
    </PulseProvider>,
  );
}

describe("PulseProvider", () => {
  beforeEach(() => {
    pulseApi.listConversations.mockResolvedValue([]);
    pulseApi.createConversation.mockResolvedValue({ id: "conv-1" });
    pulseApi.streamMessage.mockImplementation(async (id, content, cbs) => {
      cbs.onDelta("Hi ");
      cbs.onDelta("there");
      cbs.onDone({});
    });
  });

  afterEach(() => jest.clearAllMocks());

  test("loads conversations on mount", async () => {
    renderProvider();
    await waitFor(() =>
      expect(pulseApi.listConversations).toHaveBeenCalledTimes(1),
    );
  });

  test("send opens a conversation and appends the user + assistant turns", async () => {
    renderProvider();
    await waitFor(() => expect(pulseApi.listConversations).toHaveBeenCalled());

    fireEvent.click(screen.getByText("send"));

    await waitFor(() =>
      expect(pulseApi.createConversation).toHaveBeenCalledTimes(1),
    );
    expect(screen.getByTestId("msg-user")).toHaveTextContent("Hello Pulse");
    expect(pulseApi.streamMessage).toHaveBeenCalledWith(
      "conv-1",
      "Hello Pulse",
      expect.any(Object),
    );
  });

  test("accumulates streamed deltas into the assistant turn", async () => {
    renderProvider();
    fireEvent.click(screen.getByText("send"));

    await waitFor(() =>
      expect(screen.getByTestId("msg-assistant")).toHaveTextContent("Hi there"),
    );
  });

  test("clears the streaming flag when the stream is done", async () => {
    renderProvider();
    fireEvent.click(screen.getByText("send"));

    await waitFor(() =>
      expect(screen.getByTestId("streaming")).toHaveTextContent("false"),
    );
  });

  test("surfaces a stream error", async () => {
    pulseApi.streamMessage.mockImplementation(async (id, content, cbs) => {
      cbs.onError(new Error("stream failed"));
    });
    renderProvider();

    fireEvent.click(screen.getByText("send"));

    await waitFor(() =>
      expect(screen.getByTestId("error")).toHaveTextContent("stream failed"),
    );
    expect(screen.getByTestId("streaming")).toHaveTextContent("false");
  });

  test("ignores a whitespace-only send", async () => {
    renderProvider();
    await waitFor(() => expect(pulseApi.listConversations).toHaveBeenCalled());

    fireEvent.click(screen.getByText("send-blank"));

    // No conversation created, no stream started, no messages appended.
    await act(async () => {});
    expect(pulseApi.createConversation).not.toHaveBeenCalled();
    expect(pulseApi.streamMessage).not.toHaveBeenCalled();
    expect(screen.getByTestId("count")).toHaveTextContent("0");
  });

  test("newConversation creates a fresh conversation and clears messages", async () => {
    renderProvider();
    fireEvent.click(screen.getByText("send"));
    await waitFor(() =>
      expect(screen.getByTestId("msg-assistant")).toHaveTextContent("Hi there"),
    );

    fireEvent.click(screen.getByText("new"));

    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("0"));
  });

  test("usePulse throws when used outside the provider", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    function Orphan() {
      usePulse();
      return null;
    }
    expect(() => render(<Orphan />)).toThrow(
      "usePulse must be used inside <PulseProvider>",
    );
    spy.mockRestore();
  });
});
