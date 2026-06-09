/**
 * AI-USAGE SUMMARY
 * Tools: Opus 4.7
 * Overall AI Contribution: ~55%
 * AI-Assisted Areas: Drafted the chip list with source-coloured pills + truncated snippet tooltips.
 * Human Contributions: Decided to dedupe by source rather than show one chip per chunk (the model often pulls multiple chunks from the same source, which produced a wall of identical "Records Records Records" pills). Snippets from all chunks for that source are concatenated into the title tooltip so the receipts are still one hover away.
 */
import { LinkIcon } from "lucide-react";

const SOURCE_LABEL = {
  records: "Records",
  billing: "Billing",
  insurance: "Insurance",
  directives: "Care team",
};

function groupBySource(citations) {
  const order = [];
  const map = new Map();
  for (const c of citations) {
    const key = c.source || "other";
    if (!map.has(key)) {
      order.push(key);
      map.set(key, { source: key, count: 0, snippets: [] });
    }
    const entry = map.get(key);
    entry.count += 1;
    if (c.snippet) entry.snippets.push(c.snippet);
  }
  return order.map((k) => map.get(k));
}

export default function CitationChips({ citations }) {
  if (!citations?.length) return null;
  const groups = groupBySource(citations);
  return (
    <div className="pulse-citations">
      <span className="pulse-citations-label">
        <LinkIcon size={11} /> Sources
      </span>
      {groups.map((g) => (
        <span
          key={g.source}
          className={`pulse-cite pulse-cite--${g.source}`}
          title={g.snippets.slice(0, 3).join("\n———\n")}
        >
          {SOURCE_LABEL[g.source] || g.source}
          {g.count > 1 && <span className="pulse-cite-count">{g.count}</span>}
        </span>
      ))}
    </div>
  );
}
