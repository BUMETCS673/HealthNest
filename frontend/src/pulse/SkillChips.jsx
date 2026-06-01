/**
 * AI-USAGE SUMMARY
 * Tools: Opus 4.7
 * Overall AI Contribution: ~50%
 * AI-Assisted Areas: Drafted the chip row layout.
 * Human Contributions: Chose the default suggestion set ("When is my next appointment?", "Show my latest lab results") so the empty-state surfaces the two skills shipped in this PR rather than promising features that don't exist yet.
 */

export const DEFAULT_SKILL_SUGGESTIONS = [
  "When is my next appointment?",
  "Show my latest lab results",
  "What were my recent vitals?",
  "Do I have any flagged values?",
];

export default function SkillChips({ items, onPick }) {
  if (!items?.length) return null;
  return (
    <div className="pulse-chips">
      {items.map((label) => (
        <button
          key={label}
          type="button"
          className="pulse-chip"
          onClick={() => onPick(label)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
