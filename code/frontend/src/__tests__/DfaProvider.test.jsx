import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import DfaProvider, { useDfa } from "../pulse/DfaProvider";
import { dfaApi } from "../lib/dfaApi";

jest.mock("../lib/dfaApi", () => ({
  dfaApi: {
    listConversations: jest.fn(),
    createConversation: jest.fn(),
    getConversation: jest.fn(),
    deleteConversation: jest.fn(),
    streamMessage: jest.fn(),
  },
}));

function Consumer() {
  const { messages, send } = useDfa();

  return (
    <div>
      {messages.map((message) => (
        <span key={message.id} data-testid={`message-${message.role}`}>
          {message.content}
        </span>
      ))}
      <button onClick={() => send("Hello DFA")}>send</button>
    </div>
  );
}

describe("DfaProvider", () => {
  beforeEach(() => {
    dfaApi.listConversations.mockResolvedValue([]);
    dfaApi.createConversation.mockResolvedValue({ id: "conversation-1" });
    dfaApi.streamMessage.mockImplementation(
      async (_conversationId, _content, callbacks) => {
        callbacks.onDelta("Hello from DFA");
        callbacks.onDone();
      },
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("creates optimistic messages with secure local IDs when sending", async () => {
    crypto.randomUUID
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000001")
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000002");

    render(
      <DfaProvider>
        <Consumer />
      </DfaProvider>,
    );

    await waitFor(() =>
      expect(dfaApi.listConversations).toHaveBeenCalledTimes(1),
    );
    fireEvent.click(screen.getByText("send"));

    await waitFor(() =>
      expect(screen.getByTestId("message-user")).toHaveTextContent("Hello DFA"),
    );
    expect(screen.getByTestId("message-assistant")).toHaveTextContent(
      "Hello from DFA",
    );
    expect(dfaApi.streamMessage).toHaveBeenCalledWith(
      "conversation-1",
      "Hello DFA",
      expect.any(Object),
    );
    await waitFor(() =>
      expect(dfaApi.listConversations).toHaveBeenCalledTimes(2),
    );
  });
});
