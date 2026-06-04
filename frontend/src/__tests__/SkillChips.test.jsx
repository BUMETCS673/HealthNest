/*
 * AI-USAGE SUMMARY
 * Model: Claude Opus 4.8
 * Overall AI Contribution: ~80%
 * AI-Assisted Areas: Test structure and render/click setup for the SkillChips component.
 * Human Contributions: Chose the cases that matter (renders each suggestion, fires onPick with the label, hides on empty, and the default suggestion set covers the shipped skills) and verified them against the actual SkillChips behavior.
 */

import { render, screen, fireEvent } from "@testing-library/react";
import SkillChips, { DEFAULT_SKILL_SUGGESTIONS } from "../pulse/SkillChips";

describe("SkillChips", () => {
  test("renders nothing when there are no items", () => {
    const { container } = render(<SkillChips items={[]} onPick={jest.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  test("renders a button for each suggestion", () => {
    render(
      <SkillChips items={["First prompt", "Second prompt"]} onPick={jest.fn()} />,
    );
    expect(screen.getByText("First prompt")).toBeInTheDocument();
    expect(screen.getByText("Second prompt")).toBeInTheDocument();
  });

  test("calls onPick with the chip label when clicked", () => {
    const onPick = jest.fn();
    render(<SkillChips items={["Show my latest lab results"]} onPick={onPick} />);

    fireEvent.click(screen.getByText("Show my latest lab results"));

    expect(onPick).toHaveBeenCalledWith("Show my latest lab results");
  });

  test("ships default suggestions for the empty state", () => {
    expect(DEFAULT_SKILL_SUGGESTIONS).toEqual(
      expect.arrayContaining([
        "When is my next appointment?",
        "Show my latest lab results",
      ]),
    );
  });
});
