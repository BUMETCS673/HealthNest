/*
 * AI-USAGE SUMMARY
 * Model: Claude Opus 4.8
 * Overall AI Contribution: ~80%
 * AI-Assisted Areas: Test structure and render setup for the CitationChips component.
 * Human Contributions: Chose the cases that matter (dedupe-by-source with a count badge, source label mapping, snippet tooltip, and null/empty rendering) and verified them against the actual CitationChips behavior.
 */

import { render, screen } from "@testing-library/react";
import CitationChips from "../pulse/CitationChips";

describe("CitationChips", () => {
  test("renders nothing when there are no citations", () => {
    const { container } = render(<CitationChips citations={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  test("renders nothing when citations is null", () => {
    const { container } = render(<CitationChips citations={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  test("maps a known source to its display label", () => {
    render(<CitationChips citations={[{ source: "records", snippet: "x" }]} />);
    expect(screen.getByText("Records")).toBeInTheDocument();
  });

  test("dedupes multiple chunks from the same source into one chip", () => {
    render(
      <CitationChips
        citations={[
          { source: "records", snippet: "a" },
          { source: "records", snippet: "b" },
          { source: "records", snippet: "c" },
        ]}
      />,
    );
    // One chip for the source...
    expect(screen.getAllByText("Records")).toHaveLength(1);
    // ...with a count badge showing how many chunks it represents.
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  test("does not show a count badge for a single chunk", () => {
    render(<CitationChips citations={[{ source: "records", snippet: "a" }]} />);
    expect(screen.queryByText("1")).not.toBeInTheDocument();
  });

  test("keeps distinct sources as separate chips", () => {
    render(
      <CitationChips
        citations={[
          { source: "records", snippet: "a" },
          { source: "billing", snippet: "b" },
        ]}
      />,
    );
    expect(screen.getByText("Records")).toBeInTheDocument();
    expect(screen.getByText("Billing")).toBeInTheDocument();
  });

  test("falls back to the raw source string for unknown sources", () => {
    render(<CitationChips citations={[{ source: "labs", snippet: "a" }]} />);
    expect(screen.getByText("labs")).toBeInTheDocument();
  });

  test("exposes snippets through the chip title tooltip", () => {
    render(
      <CitationChips
        citations={[{ source: "records", snippet: "Appointment with Dr. Smith" }]}
      />,
    );
    expect(screen.getByText("Records").title).toContain(
      "Appointment with Dr. Smith",
    );
  });
});
