/*
 * AI-USAGE SUMMARY
 * Model: Claude Opus 4.8
 * Overall AI Contribution: ~80%
 * AI-Assisted Areas: Test structure, render setup, and the child-card mocks for SkillResponseCard.
 * Human Contributions: Chose the dispatch cases that matter (appointments -> AppointmentsCard, lab results -> LabResultsCard, unknown skill -> raw JSON fallback, and the null-payload guard) and verified them against the actual dispatch switch.
 */

import { render, screen } from "@testing-library/react";
import SkillResponseCard from "../pulse/SkillResponseCard";

// Stub the heavy child cards so this test stays focused on the dispatch logic.
jest.mock("../pulse/cards/AppointmentsCard", () => () => (
  <div data-testid="appointments-card" />
));
jest.mock("../pulse/cards/BookAppointmentCard", () => () => (
  <div data-testid="book-appointment-card" />
));
jest.mock("../pulse/cards/LabResultsCard", () => () => (
  <div data-testid="lab-results-card" />
));

describe("SkillResponseCard", () => {
  test("renders nothing without a payload", () => {
    const { container } = render(
      <SkillResponseCard skillOutput={{ skill: "get_appointments" }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  test("dispatches get_appointments to the appointments card", () => {
    render(
      <SkillResponseCard
        skillOutput={{ skill: "get_appointments", payload: { appointments: [] } }}
      />,
    );
    expect(screen.getByTestId("appointments-card")).toBeInTheDocument();
  });

  test("dispatches book_appointment to the book appointment card", () => {
    render(
      <SkillResponseCard
        skillOutput={{ skill: "book_appointment", payload: { stage: "none" } }}
      />,
    );
    expect(screen.getByTestId("book-appointment-card")).toBeInTheDocument();
  });

  test("dispatches get_lab_results to the lab results card", () => {
    render(
      <SkillResponseCard
        skillOutput={{ skill: "get_lab_results", payload: { results: [] } }}
      />,
    );
    expect(screen.getByTestId("lab-results-card")).toBeInTheDocument();
  });

  test("renders the raw payload for an unknown skill", () => {
    render(
      <SkillResponseCard
        skillOutput={{ skill: "mystery_skill", payload: { foo: "bar" } }}
      />,
    );
    expect(screen.getByText("mystery_skill")).toBeInTheDocument();
    expect(screen.getByText(/"foo": "bar"/)).toBeInTheDocument();
  });
});
