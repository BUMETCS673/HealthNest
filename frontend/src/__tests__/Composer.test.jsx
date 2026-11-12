/*
 * AI-USAGE SUMMARY
 * Model: Claude Opus 4.8
 * Overall AI Contribution: ~80%
 * AI-Assisted Areas: Test structure, render/typing setup, and the keyboard-event firing for the Composer.
 * Human Contributions: Chose the cases that matter (Enter sends, Shift+Enter does not, Cmd/Ctrl+Enter sends, whitespace-only is ignored, the input clears after send, and the disabled state blocks sending) and verified them against the actual Composer behavior.
 */

import { render, screen, fireEvent } from "@testing-library/react";
import Composer from "../pulse/Composer";

function getInput() {
  return screen.getByPlaceholderText("Message Pulse");
}

describe("Composer", () => {
  test("updates the textarea as the user types", () => {
    render(<Composer onSend={jest.fn()} />);
    const input = getInput();
    fireEvent.change(input, { target: { value: "hello" } });
    expect(input.value).toBe("hello");
  });

  test("sends on Enter and clears the input", () => {
    const onSend = jest.fn();
    render(<Composer onSend={onSend} />);
    const input = getInput();

    fireEvent.change(input, { target: { value: "When is my next visit?" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSend).toHaveBeenCalledWith("When is my next visit?");
    expect(input.value).toBe("");
  });

  test("does not send on Shift+Enter (newline)", () => {
    const onSend = jest.fn();
    render(<Composer onSend={onSend} />);
    const input = getInput();

    fireEvent.change(input, { target: { value: "line one" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });

    expect(onSend).not.toHaveBeenCalled();
  });

  test("sends on Cmd/Ctrl+Enter", () => {
    const onSend = jest.fn();
    render(<Composer onSend={onSend} />);
    const input = getInput();

    fireEvent.change(input, { target: { value: "ping" } });
    fireEvent.keyDown(input, { key: "Enter", metaKey: true });

    expect(onSend).toHaveBeenCalledWith("ping");
  });

  test("ignores whitespace-only input", () => {
    const onSend = jest.fn();
    render(<Composer onSend={onSend} />);
    const input = getInput();

    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSend).not.toHaveBeenCalled();
  });

  test("sends when the send button is clicked", () => {
    const onSend = jest.fn();
    render(<Composer onSend={onSend} />);

    fireEvent.change(getInput(), { target: { value: "go" } });
    fireEvent.click(screen.getByLabelText("Send message"));

    expect(onSend).toHaveBeenCalledWith("go");
  });

  test("does not send while disabled", () => {
    const onSend = jest.fn();
    render(<Composer onSend={onSend} disabled />);
    const input = getInput();

    fireEvent.change(input, { target: { value: "blocked" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSend).not.toHaveBeenCalled();
  });

  test("disables the send button when input is empty", () => {
    render(<Composer onSend={jest.fn()} />);
    expect(screen.getByLabelText("Send message")).toBeDisabled();
  });
});
