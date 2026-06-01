/*
 * AI-usage: 30% (tool: Claude; helped with mock setup, render setup, and basic test structure)
 * Human code: 70% (Chose the test cases, adjusted the test logic, expected values, and checked them against the actual
 * LabResultDetail behavior)
 */

import { render, screen, waitFor } from "@testing-library/react";
import LabResultDetail from "../LabResultDetail";

// mock the lab results api
jest.mock("../lib/labResultsApi", () => ({
  labResultsApi: {
    get: jest.fn(),
    fileUrl: jest.fn(),
  },
}));

import { labResultsApi } from "../lib/labResultsApi";

// sample released lab result
const mockResult = {
  id: "lr-1",
  lab_name: "CBC Panel",
  status: "released",
  collected_at: "2026-06-01T10:00:00",
  resulted_at: "2026-06-02T10:00:00",
  released_at: "2026-06-03T10:00:00",
  entries: [
    {
      id: "e-1",
      component_name: "Hemoglobin",
      loinc_code: "718-7",
      value: "13.5",
      unit: "g/dL",
      reference_range: "12.0-16.0",
      abnormal_flag: "normal",
    },
    {
      id: "e-2",
      component_name: "WBC",
      loinc_code: "6690-2",
      value: "15.2",
      unit: "10^3/uL",
      reference_range: "4.5-11.0",
      abnormal_flag: "high",
    },
  ],
};

describe("LabResultDetail", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Loading state test
  test("shows the loading spinner before the result finishes loading", () => {
    labResultsApi.get.mockResolvedValue(mockResult);

    render(<LabResultDetail labResultId='lr-1' onBack={jest.fn()} />);

    expect(document.querySelector(".lab-spinner")).toBeInTheDocument();
  });

  // Basic page content test
  test("shows the lab name after the API call finishes", async () => {
    labResultsApi.get.mockResolvedValue(mockResult);

    render(<LabResultDetail labResultId='lr-1' onBack={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("CBC Panel")).toBeInTheDocument();
    });
  });

  // Table content test
  test("shows the lab result entries in the table", async () => {
    labResultsApi.get.mockResolvedValue(mockResult);

    render(<LabResultDetail labResultId='lr-1' onBack={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Hemoglobin")).toBeInTheDocument();
      expect(screen.getByText("WBC")).toBeInTheDocument();
    });
  });

  // Flagged result warning test
  test("shows the abnormal result message when a value is flagged", async () => {
    labResultsApi.get.mockResolvedValue(mockResult);

    render(<LabResultDetail labResultId='lr-1' onBack={jest.fn()} />);

    await waitFor(() => {
      expect(
        screen.getByText((content) =>
          content.includes("outside the reference range"),
        ),
      ).toBeInTheDocument();
    });
  });

  // File download button test
  test("shows the Download file button", async () => {
    labResultsApi.get.mockResolvedValue(mockResult);

    render(<LabResultDetail labResultId='lr-1' onBack={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Download file")).toBeInTheDocument();
    });
  });

  // Error state test
  test("shows an error message when the lab result cannot be loaded", async () => {
    labResultsApi.get.mockRejectedValue(new Error("Not found"));

    render(<LabResultDetail labResultId='lr-1' onBack={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Not found")).toBeInTheDocument();
    });
  });
});
