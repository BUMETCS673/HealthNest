import { useEffect, useRef, useState } from "react";
import { User, Send } from "lucide-react";
import { useMessages } from "./MessagesProvider";

/**
 * The messaging body (contacts sidebar + thread + composer), without any nav.
 * Reused by the patient MessagesPage and the provider dashboard.
 * `myId` is the caller's auth user id (used to right-align their own bubbles).
 */
export default function MessagesView({ myId }) {
  const {
    contacts,
    activeContactId,
    thread,
    unreadByContact,
    openThread,
    send,
    loadContacts,
  } = useMessages();

  const [draft, setDraft] = useState("");
  const threadEndRef = useRef(null);

  useEffect(() => {
    loadContacts?.();
  }, [loadContacts]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread]);

  const activeContact = contacts.find((c) => c.user_id === activeContactId);

  const handleSend = async (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    await send(text);
  };

  return (
    <div className="mp-layout">
      {/* Contacts sidebar */}
      <aside className="mp-sidebar">
        <h2 className="mp-sidebar-title">Messages</h2>
        {contacts.length === 0 ? (
          <p className="mp-empty">No care-team contacts yet.</p>
        ) : (
          <div className="mp-contact-list">
            {contacts.map((c) => {
              const unread = unreadByContact[c.user_id] || 0;
              return (
                <button
                  key={c.user_id}
                  className={`mp-contact ${c.user_id === activeContactId ? "active" : ""}`}
                  onClick={() => openThread(c.user_id)}
                >
                  <div className="mp-contact-avatar">
                    <User size={18} />
                  </div>
                  <div className="mp-contact-info">
                    <span className="mp-contact-name">{c.name}</span>
                    {c.specialty && (
                      <span className="mp-contact-sub">{c.specialty}</span>
                    )}
                  </div>
                  {unread > 0 && (
                    <span className="mp-contact-badge">{unread}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </aside>

      {/* Thread pane */}
      <section className="mp-thread-pane">
        {!activeContactId ? (
          <div className="mp-thread-empty">
            <User size={40} />
            <p>Select a conversation to start messaging.</p>
          </div>
        ) : (
          <>
            <div className="mp-thread-head">
              <p className="mp-thread-name">
                {activeContact?.name ?? "Conversation"}
              </p>
              {activeContact?.specialty && (
                <span className="mp-thread-sub">{activeContact.specialty}</span>
              )}
            </div>

            <div className="mp-thread-body">
              {thread.length === 0 ? (
                <p className="mp-empty">No messages yet. Say hello.</p>
              ) : (
                thread.map((m) => (
                  <div
                    key={m.id}
                    className={`mp-bubble ${m.sender_id === myId ? "mine" : "theirs"}`}
                  >
                    <p className="mp-bubble-body">{m.body}</p>
                    <span className="mp-bubble-time">
                      {new Date(m.sent_at).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                ))
              )}
              <div ref={threadEndRef} />
            </div>

            <form className="mp-composer" onSubmit={handleSend}>
              <input
                className="mp-composer-input"
                placeholder="Type a message…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              <button
                className="mp-composer-send"
                type="submit"
                disabled={!draft.trim()}
                aria-label="Send"
              >
                <Send size={16} />
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
