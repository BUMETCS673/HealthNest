/*
 * AI-generated code: 40% (tool: Claude; helped with mock setup,
 * render setup, and basic test structure)
 * Human code: 60% (Chose the test cases, adjusted the test logic, expected values,
 * and checked them against the actual LabResultsPage behavior)
 */

import { render, screen, waitFor } from "@testing-library/react";
import LabResultsPage from "../labresults/LabResultsPage";

jest.mock("../lib/labResultsApi", () => ({
  labResultsApi: {
    list: jest.fn(),
  },
}));

jest.mock("../lib/patientsApi", () => ({
  patientsApi: {
    getMany: jest.fn(),
  },
  formatPatientName: jest.fn(
    (patient) => `${patient.first_name} ${patient.last_name}`,
  ),
}));

import { labResultsApi } from "../lib/labResultsApi";

describe("LabResultsPage", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Basic page title test
  test("shows the Lab Results page title", () => {
    labResultsApi.list.mockResolvedValue([]);

    render(<LabResultsPage onBack={jest.fn()} onOpenReview={jest.fn()} />);

    expect(screen.getByText("Lab Results")).toBeInTheDocument();
  });

  // Upload area test
  test("shows the upload area for lab result files", () => {
    labResultsApi.list.mockResolvedValue([]);

    render(<LabResultsPage onBack={jest.fn()} onOpenReview={jest.fn()} />);

    expect(screen.getByText("Drop lab results here")).toBeInTheDocument();
  });

  // Browse button test
  test("shows the Browse files button", () => {
    labResultsApi.list.mockResolvedValue([]);

    render(<LabResultsPage onBack={jest.fn()} onOpenReview={jest.fn()} />);

    expect(screen.getByText("Browse files")).toBeInTheDocument();
  });

  // Empty state test
  test("shows the empty message when there are no pending results", async () => {
    labResultsApi.list.mockResolvedValue([]);

    render(<LabResultsPage onBack={jest.fn()} onOpenReview={jest.fn()} />);

    await waitFor(() => {
      expect(
        screen.getByText(
          "No results awaiting review. Upload a file above to start.",
        ),
      ).toBeInTheDocument();
    });
  });

  // Pending lab result test
  test("shows a pending lab result after the API call finishes", async () => {
    labResultsApi.list.mockResolvedValue([
      {
        id: "lr-1",
        lab_name: "CBC Panel",
        status: "uploaded",
        patient_id: "p-1",
        collected_at: "2026-06-01T10:00:00",
        entries: [],
        flagged_count: 0,
      },
    ]);

    render(<LabResultsPage onBack={jest.fn()} onOpenReview={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("CBC Panel")).toBeInTheDocument();
    });
  });

  // Review action button test
  test("shows the Review and Release button for a pending result", async () => {
    labResultsApi.list.mockResolvedValue([
      {
        id: "lr-1",
        lab_name: "CBC Panel",
        status: "uploaded",
        patient_id: "p-1",
        collected_at: "2026-06-01T10:00:00",
        entries: [],
        flagged_count: 0,
      },
    ]);

    render(<LabResultsPage onBack={jest.fn()} onOpenReview={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Review & Release")).toBeInTheDocument();
    });
  });
});
