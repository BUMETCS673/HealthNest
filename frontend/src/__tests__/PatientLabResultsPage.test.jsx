/*
 * AI-usage: 40% (tool: Claude helped with mock setup, render setup, and test structure)
 * Human code: 60% (Chose the test cases and checked the expected results
 * with the actual behavior)
 */

import { render, screen, waitFor } from "@testing-library/react";
import PatientLabResultsPage from "../PatientLabResultsPage";

jest.mock("../lib/labResultsApi", () => ({
  labResultsApi: {
    list: jest.fn(),
  },
}));

import { labResultsApi } from "../lib/labResultsApi";

describe("PatientLabResultsPage", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Loading state test
  test("shows the loading spinner before results finish loading", () => {
    labResultsApi.list.mockResolvedValue([]);

    render(
      <PatientLabResultsPage onBack={jest.fn()} onOpenDetail={jest.fn()} />,
    );

    expect(document.querySelector(".lab-spinner")).toBeInTheDocument();
  });

  // Empty state test
  test("shows the empty message when the patient has no lab results", async () => {
    labResultsApi.list.mockResolvedValue([]);

    render(
      <PatientLabResultsPage onBack={jest.fn()} onOpenDetail={jest.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText("No results yet")).toBeInTheDocument();
    });
  });

  // Basic page title test
  test("shows the Lab Results page title", () => {
    labResultsApi.list.mockResolvedValue([]);

    render(
      <PatientLabResultsPage onBack={jest.fn()} onOpenDetail={jest.fn()} />,
    );

    expect(screen.getByText("Lab Results")).toBeInTheDocument();
  });

  // Released lab result test
  test("shows a released lab result after the API call finishes", async () => {
    labResultsApi.list.mockResolvedValue([
      {
        id: "lr-1",
        lab_name: "CBC Panel",
        status: "released",
        resulted_at: "2026-06-01T10:00:00",
        released_at: "2026-06-02T10:00:00",
        entries: [],
        flagged_count: 0,
      },
    ]);

    render(
      <PatientLabResultsPage onBack={jest.fn()} onOpenDetail={jest.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText("CBC Panel")).toBeInTheDocument();
    });
  });

  // Flagged result test
  test("shows a flagged badge when a result has flagged values", async () => {
    labResultsApi.list.mockResolvedValue([
      {
        id: "lr-2",
        lab_name: "Lipid Panel",
        status: "released",
        resulted_at: "2026-06-01T10:00:00",
        released_at: "2026-06-02T10:00:00",
        entries: [],
        flagged_count: 2,
      },
    ]);

    render(
      <PatientLabResultsPage onBack={jest.fn()} onOpenDetail={jest.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText("2 flagged")).toBeInTheDocument();
    });
  });

  // View results button test
  test("shows a View results button for the lab result", async () => {
    labResultsApi.list.mockResolvedValue([
      {
        id: "lr-3",
        lab_name: "HbA1c",
        status: "released",
        resulted_at: "2026-06-01T10:00:00",
        released_at: "2026-06-02T10:00:00",
        entries: [],
        flagged_count: 0,
      },
    ]);

    render(
      <PatientLabResultsPage onBack={jest.fn()} onOpenDetail={jest.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText("View results")).toBeInTheDocument();
    });
  });
});
