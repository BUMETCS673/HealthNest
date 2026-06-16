/*
 * AI-usage: 50% (tool: Claude; helped with mock setup,
 * render setup, and basic test structure)
 * Human code: 50% (Chose the test cases, adjusted the test logic, expected values, and checked them against the actual
 * LabResultReview behavior)
 */

import { render, screen, waitFor } from "@testing-library/react";
import LabResultReview from "../labresults/LabResultReview";
import { patientsApi } from "../lib/patientsApi";

jest.mock("../lib/labResultsApi", () => ({
  labResultsApi: {
    get: jest.fn(),
    patch: jest.fn(),
    release: jest.fn(),
    archive: jest.fn(),
    fileUrl: jest.fn(),
  },
}));

jest.mock("../lib/patientsApi", () => ({
  patientsApi: {
    get: jest.fn(),
  },
  formatPatientName: jest.fn(
    (patient) => `${patient.first_name} ${patient.last_name}`,
  ),
  formatPatientSubtitle: jest.fn(() => ""),
}));

import { labResultsApi } from "../lib/labResultsApi";

const mockResult = {
  id: "lr-1",
  lab_name: "CBC Panel",
  status: "uploaded",
  patient_id: "p-1",
  source_format: "hl7",
  parser_version: "1.0",
  created_at: "2026-06-01T10:00:00",
  collected_at: "2026-06-01T10:00:00",
  resulted_at: "2026-06-02T10:00:00",
  released_at: null,
  ordering_provider_name: "Dr. Smith",
  notes: "",
  parse_error: null,
  entries: [
    {
      id: "e-1",
      component_name: "Hemoglobin",
      loinc_code: "718-7",
      value: "13.5",
      value_numeric: 13.5,
      unit: "g/dL",
      reference_range: "12.0-16.0",
      abnormal_flag: "normal",
      needs_manual_entry: false,
      display_order: 0,
    },
  ],
};

describe("LabResultReview", () => {
  beforeEach(() => {
    // ← add this block
    patientsApi.get.mockResolvedValue({
      id: "p-1",
      first_name: "John",
      last_name: "Doe",
      mrn: "12345",
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Loading state test
  test("shows the loading spinner before the review finishes loading", () => {
    labResultsApi.get.mockResolvedValue(mockResult);

    render(
      <LabResultReview
        labResultId='lr-1'
        onBack={jest.fn()}
        onChanged={jest.fn()}
      />,
    );

    expect(document.querySelector(".lab-spinner")).toBeInTheDocument();
  });

  // Basic page title test
  test("shows the lab result review title after the API call finishes", async () => {
    labResultsApi.get.mockResolvedValue(mockResult);

    render(
      <LabResultReview
        labResultId='lr-1'
        onBack={jest.fn()}
        onChanged={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Lab result review")).toBeInTheDocument();
    });
  });

  // Lab metadata form test
  test("shows the lab name in the review form", async () => {
    labResultsApi.get.mockResolvedValue(mockResult);

    render(
      <LabResultReview
        labResultId='lr-1'
        onBack={jest.fn()}
        onChanged={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue("CBC Panel")).toBeInTheDocument();
    });
  });

  // Entries table test
  test("shows the lab component name in the entries table", async () => {
    labResultsApi.get.mockResolvedValue(mockResult);

    render(
      <LabResultReview
        labResultId='lr-1'
        onBack={jest.fn()}
        onChanged={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue("Hemoglobin")).toBeInTheDocument();
    });
  });

  // Release action button test
  test("shows the Release to patient button for an uploaded result", async () => {
    labResultsApi.get.mockResolvedValue(mockResult);

    render(
      <LabResultReview
        labResultId='lr-1'
        onBack={jest.fn()}
        onChanged={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Release to patient")).toBeInTheDocument();
    });
  });

  // Save action button test
  test("shows the Save changes button for an uploaded result", async () => {
    labResultsApi.get.mockResolvedValue(mockResult);

    render(
      <LabResultReview
        labResultId='lr-1'
        onBack={jest.fn()}
        onChanged={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Save changes")).toBeInTheDocument();
    });
  });

  // Error state test
  test("shows an error message when the review cannot be loaded", async () => {
    labResultsApi.get.mockRejectedValue(new Error("Failed to load"));

    render(
      <LabResultReview
        labResultId='lr-1'
        onBack={jest.fn()}
        onChanged={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Failed to load")).toBeInTheDocument();
    });
  });
});
