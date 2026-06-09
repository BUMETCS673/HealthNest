/*
 * AI-USAGE SUMMARY
 * Model: Claude Opus 4.8
 * Overall AI Contribution: ~80%
 * AI-Assisted Areas: Test structure, render/click setup, and the list/detail payload fixtures for LabResultsCard.
 * Human Contributions: Chose the cases that matter (list vs detail mode, the abnormal-flag pill, the missing-detail guard, empty list, and both onNavigate('labs', ...) hooks) and verified the rendered analyte row against the actual card. Times use a midday suffix so date formatting stays timezone-stable.
 */

import { render, screen, fireEvent } from "@testing-library/react";
import LabResultsCard from "../pulse/cards/LabResultsCard";

const detailResult = {
  id: "lab-1",
  lab_name: "Lipid Panel",
  resulted_at: "2026-05-02T12:00:00",
  released_at: "2026-05-03T12:00:00",
  flagged_count: 1,
  entries: [
    {
      id: "e1",
      component_name: "LDL Cholesterol",
      value: "160",
      unit: "mg/dL",
      reference_range: "<100",
      abnormal_flag: "high",
    },
    {
      id: "e2",
      component_name: "HDL Cholesterol",
      value: "55",
      unit: "mg/dL",
      reference_range: ">40",
      abnormal_flag: "normal",
    },
  ],
};

describe("LabResultsCard — list mode", () => {
  test("renders the empty state when there are no results", () => {
    render(<LabResultsCard payload={{ op: "list", results: [] }} />);
    expect(screen.getByText("No released lab results yet.")).toBeInTheDocument();
  });

  test("lists each released result by name", () => {
    render(
      <LabResultsCard
        payload={{
          op: "list",
          results: [
            { id: "l1", lab_name: "CBC", resulted_at: "2026-05-01T12:00:00" },
            { id: "l2", lab_name: "HbA1c", resulted_at: "2026-05-02T12:00:00" },
          ],
        }}
      />,
    );
    expect(screen.getByText("CBC")).toBeInTheDocument();
    expect(screen.getByText("HbA1c")).toBeInTheDocument();
  });

  test("navigates to a specific lab when a list item is clicked", () => {
    const onNavigate = jest.fn();
    render(
      <LabResultsCard
        payload={{
          op: "list",
          results: [{ id: "l1", lab_name: "CBC", resulted_at: "2026-05-01T12:00:00" }],
        }}
        onNavigate={onNavigate}
      />,
    );
    fireEvent.click(screen.getByText("CBC"));
    expect(onNavigate).toHaveBeenCalledWith("labs", { labResultId: "l1" });
  });

  test("the See all link navigates to the labs page", () => {
    const onNavigate = jest.fn();
    render(
      <LabResultsCard payload={{ op: "list", results: [] }} onNavigate={onNavigate} />,
    );
    fireEvent.click(screen.getByText("See all"));
    expect(onNavigate).toHaveBeenCalledWith("labs");
  });
});

describe("LabResultsCard — detail mode", () => {
  test("renders the lab name and analyte rows", () => {
    render(<LabResultsCard payload={{ op: "detail", results: [detailResult] }} />);
    expect(screen.getByText("Lipid Panel")).toBeInTheDocument();
    expect(screen.getByText("LDL Cholesterol")).toBeInTheDocument();
    expect(screen.getByText("<100")).toBeInTheDocument();
  });

  test("renders a flag pill for an abnormal value but not a normal one", () => {
    render(<LabResultsCard payload={{ op: "detail", results: [detailResult] }} />);
    // "high" -> "High" pill is shown; the normal HDL row has no pill.
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.queryByText("Normal")).not.toBeInTheDocument();
  });

  test("shows the flagged-count meta", () => {
    render(<LabResultsCard payload={{ op: "detail", results: [detailResult] }} />);
    expect(screen.getByText(/1 flagged/)).toBeInTheDocument();
  });

  test("guards against a detail payload with no result", () => {
    render(<LabResultsCard payload={{ op: "detail", results: [] }} />);
    expect(screen.getByText("That lab result isn't available.")).toBeInTheDocument();
  });

  test("the Open full result link navigates with the lab id", () => {
    const onNavigate = jest.fn();
    render(
      <LabResultsCard
        payload={{ op: "detail", results: [detailResult] }}
        onNavigate={onNavigate}
      />,
    );
    fireEvent.click(screen.getByText("Open full result"));
    expect(onNavigate).toHaveBeenCalledWith("labs", { labResultId: "lab-1" });
  });
});
