/*
 * AI-generated code: 20% (tool: ChatGPT; basic Jest structure support)
 * Human code: 80% (defined test cases, expected behavior, and verified results)
 */

import { render, screen, fireEvent } from "@testing-library/react";
import ConfirmModal from "../booking/ConfirmModal";

describe("ConfirmModal", () => {
  const defaultProps = {
    open: true,
    title: "Cancel Appointment",
    message: "Are you sure you want to cancel this appointment?",
    onConfirm: jest.fn(),
    onCancel: jest.fn(),
  };

  test("shows the title and message when the modal is open", () => {
    render(<ConfirmModal {...defaultProps} />);

    expect(screen.getByText("Cancel Appointment")).toBeInTheDocument();
    expect(
      screen.getByText("Are you sure you want to cancel this appointment?"),
    ).toBeInTheDocument();
  });

  test("does not show the modal when open is false", () => {
    render(<ConfirmModal {...defaultProps} open={false} />);

    expect(screen.queryByText("Cancel Appointment")).not.toBeInTheDocument();
  });

  test("runs the confirm action when the confirm button is clicked", () => {
    const onConfirm = jest.fn();

    render(<ConfirmModal {...defaultProps} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByText("Confirm"));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  test("runs the cancel action when the cancel button is clicked", () => {
    const onCancel = jest.fn();

    render(<ConfirmModal {...defaultProps} onCancel={onCancel} />);

    fireEvent.click(screen.getByText("Cancel"));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  test("shows custom button labels when they are provided", () => {
    render(
      <ConfirmModal
        {...defaultProps}
        confirmLabel='Yes, cancel'
        cancelLabel='Keep'
      />,
    );

    expect(screen.getByText("Yes, cancel")).toBeInTheDocument();
    expect(screen.getByText("Keep")).toBeInTheDocument();
  });

  test("disables the buttons while the modal is busy", () => {
    render(<ConfirmModal {...defaultProps} busy={true} />);

    const cancelButton = screen.getByText("Cancel");
    expect(cancelButton).toBeDisabled();
  });
});
