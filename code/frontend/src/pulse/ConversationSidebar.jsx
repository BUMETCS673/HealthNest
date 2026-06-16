/**
 * AI-USAGE SUMMARY
 * Tools: Opus 4.7
 * Overall AI Contribution: ~55%
 * AI-Assisted Areas: Drafted the conversation row layout (title fallback to first user message preview, last-activity timestamp).
 * Human Contributions: Decided the New Chat button always creates a fresh conversation rather than clearing the current one, so the audit trail per conversation stays single-purpose.
 */
import { Plus, MessageCircle } from "lucide-react";

function formatWhen(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString();
}

export default function ConversationSidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
}) {
  return (
    <aside className="pulse-sidebar">
      <button
        type="button"
        className="pulse-sidebar-new"
        onClick={onNew}
      >
        <Plus size={14} /> New chat
      </button>
      <div className="pulse-sidebar-list">
        {(!conversations || conversations.length === 0) && (
          <p className="pulse-sidebar-empty">No prior chats yet.</p>
        )}
        {conversations?.map((c) => {
          const title =
            c.title?.trim() ||
            c.last_message_preview ||
            "New conversation";
          const active = c.id === activeId;
          return (
            <button
              key={c.id}
              type="button"
              className={`pulse-sidebar-row ${active ? "pulse-sidebar-row--active" : ""}`}
              onClick={() => onSelect(c.id)}
            >
              <MessageCircle size={13} />
              <div className="pulse-sidebar-row-body">
                <span className="pulse-sidebar-row-title">{title}</span>
                <span className="pulse-sidebar-row-when">
                  {formatWhen(c.last_message_at || c.started_at)}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
