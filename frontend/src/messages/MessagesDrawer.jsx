/**
 * AI-USAGE SUMMARY
 * Tools: Claude Code (Opus 4.8)
 * Overall AI Contribution: ~60%
 * AI-Assisted Areas: Drafted the global left-side messaging drawer + floating
 *   launcher (contacts ↔ thread ↔ composer, unread badge, "Open messages"
 *   shortcut), mirroring the Pulse drawer pattern.
 * Human Contributions: Requested the left-side placement and the open-full-page
 *   shortcut; decided it reuses the MessagesProvider context so the drawer and
 *   full Messages page stay in sync.
 * Notes: Verified via `npm run build` and the jest suite.
 */
import { useEffect, useRef, useState } from "react";
import {
  MessageSquare,
  X,
  ArrowUpRight,
  ChevronLeft,
  Send,
  User,
} from "lucide-react";
import { useMessages } from "./MessagesProvider";
import "./MessagesDrawer.css";

/**
 * Global left-side messaging drawer + floating launcher, mirroring the Pulse
 * drawer (which lives on the right). Reuses the MessagesProvider context, so
 * conversations stay in sync with the full Messages page.
 */
export default function MessagesDrawer({
  myId,
  onOpenMessages,
  hideLauncher = false,
}) {
  const {
    drawerOpen,
    openDrawer,
    closeDrawer,
    contacts,
    activeContactId,
    thread,
    unreadCount,
    unreadByContact,
    openThread,
    closeThread,
    send,
  } = useMessages();

  const [draft, setDraft] = useState("");
  const endRef = useRef(null);

  // Escape closes the drawer (matches Pulse)
  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") closeDrawer();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen, closeDrawer]);

  // Auto-scroll the open thread
  useEffect(() => {
    if (drawerOpen && activeContactId) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [thread, drawerOpen, activeContactId]);

  const activeContact = contacts.find((c) => c.user_id === activeContactId);

  const handleSend = async (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    await send(text);
  };

  return (
    <>
      {/* Floating launcher (bottom-left). Hidden on the messages page and while open. */}
      {!hideLauncher && !drawerOpen && (
        <button
          type="button"
          className="msg-fab"
          onClick={openDrawer}
          aria-label="Open messages"
          title="Messages"
        >
          <MessageSquare size={22} />
          {unreadCount > 0 && (
            <span className="msg-fab-badge">{unreadCount}</span>
          )}
        </button>
      )}

      {drawerOpen && <div className="msg-scrim" onClick={closeDrawer} />}

      <aside
        className={`msg-drawer ${drawerOpen ? "is-open" : ""}`}
        aria-hidden={!drawerOpen}
      >
        <header className="msg-drawer-head">
          <span className="msg-drawer-brand">
            <span className="msg-drawer-dot" aria-hidden="true" />
            Messages
            {unreadCount > 0 && (
              <span className="msg-drawer-count">{unreadCount}</span>
            )}
          </span>
          <div className="msg-drawer-actions">
            <button
              type="button"
              className="msg-btn msg-btn--primary"
              onClick={() => {
                closeDrawer();
                onOpenMessages?.();
              }}
              title="Open the full messages page"
            >
              Open messages
              <ArrowUpRight size={12} strokeWidth={2.25} />
            </button>
            <button
              type="button"
              className="msg-icon-btn"
              onClick={closeDrawer}
              aria-label="Close"
            >
              <X size={14} strokeWidth={2.25} />
            </button>
          </div>
        </header>

        {/* Conversation sub-header with a back button */}
        {activeContactId && (
          <div className="msg-subhead">
            <button
              type="button"
              className="msg-icon-btn"
              onClick={closeThread}
              aria-label="Back to conversations"
            >
              <ChevronLeft size={16} strokeWidth={2.25} />
            </button>
            <span className="msg-subhead-name">
              {activeContact?.name ?? "Conversation"}
            </span>
            {activeContact?.specialty && (
              <span className="msg-subhead-sub">{activeContact.specialty}</span>
            )}
          </div>
        )}

        <div className="msg-drawer-body">
          {!activeContactId ? (
            contacts.length === 0 ? (
              <p className="msg-empty">No care-team contacts yet.</p>
            ) : (
              <div className="msg-contact-list">
                {contacts.map((c) => {
                  const unread = unreadByContact[c.user_id] || 0;
                  return (
                    <button
                      key={c.user_id}
                      type="button"
                      className="msg-contact"
                      onClick={() => openThread(c.user_id)}
                    >
                      <div className="msg-contact-avatar">
                        <User size={16} />
                      </div>
                      <div className="msg-contact-info">
                        <span className="msg-contact-name">{c.name}</span>
                        {c.specialty && (
                          <span className="msg-contact-sub">{c.specialty}</span>
                        )}
                      </div>
                      {unread > 0 && (
                        <span className="msg-contact-badge">{unread}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )
          ) : (
            <div className="msg-thread">
              {thread.length === 0 ? (
                <p className="msg-empty">No messages yet. Say hello.</p>
              ) : (
                thread.map((m) => (
                  <div
                    key={m.id}
                    className={`msg-bubble ${m.sender_id === myId ? "mine" : "theirs"}`}
                  >
                    {m.body}
                  </div>
                ))
              )}
              <div ref={endRef} />
            </div>
          )}
        </div>

        {activeContactId && (
          <form className="msg-drawer-foot" onSubmit={handleSend}>
            <input
              className="msg-composer-input"
              placeholder="Type a message…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button
              type="submit"
              className="msg-composer-send"
              disabled={!draft.trim()}
              aria-label="Send"
            >
              <Send size={15} />
            </button>
          </form>
        )}
      </aside>
    </>
  );
}
