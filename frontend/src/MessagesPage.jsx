import { useState, useEffect, useRef } from "react";
import { Bell, ChevronDown, LogOut, User, Send } from "lucide-react";
import { messagesApi } from "./lib/messagesApi";
import "./MessagesPage.css";

export default function MessagesPage({ user, onNavigate, onSignOut }) {
  const [inbox, setInbox] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recipientId, setRecipientId] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // same click-outside pattern as other pages
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target))
        setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const fullName =
    `${user?.user_metadata?.first_name ?? ""} ${user?.user_metadata?.last_name ?? ""}`.trim() ||
    user?.email ||
    "Patient";

  useEffect(() => {
    messagesApi
      .getInbox()
      .then(setInbox)
      .catch(() => setInbox([]))
      .finally(() => setLoading(false));
  }, []);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!recipientId.trim() || !body.trim()) return;
    setSending(true);
    setError("");
    try {
      await messagesApi.sendMessage(recipientId.trim(), body.trim());
      setBody("");
      setRecipientId("");
    } catch (err) {
      setError(err.message || "Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  const navLinks = [
    "Dashboard",
    "Appointments",
    "My Care Team",
    "Records",
    "Messages",
    "Pulse AI",
  ];

  return (
    <div className="mp-page">
      {/* Nav — copy the ap-nav pattern exactly, changing class prefix to mp- */}
      {/* ... nav JSX ... */}

      <main className="mp-main">
        <h1 className="mp-title">Messages</h1>

        {/* Compose form */}
        <section className="mp-compose">
          <h2 className="mp-section-title">New Message</h2>
          <form onSubmit={handleSend} className="mp-form">
            <input
              className="mp-input"
              placeholder="Recipient user ID"
              value={recipientId}
              onChange={(e) => setRecipientId(e.target.value)}
            />
            <textarea
              className="mp-textarea"
              placeholder="Write your message…"
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            {error && <p className="mp-error">{error}</p>}
            <button className="mp-send-btn" type="submit" disabled={sending}>
              <Send size={16} /> {sending ? "Sending…" : "Send Message"}
            </button>
          </form>
        </section>

        {/* Inbox */}
        <section className="mp-inbox">
          <h2 className="mp-section-title">Inbox</h2>
          {loading ? (
            <p className="mp-loading">Loading…</p>
          ) : inbox.length === 0 ? (
            <p className="mp-empty">No messages yet.</p>
          ) : (
            <div className="mp-list">
              {inbox.map((msg) => (
                <div key={msg.id} className="mp-card">
                  <p className="mp-card-from">From: {msg.sender_id}</p>
                  <p className="mp-card-body">{msg.body}</p>
                  <p className="mp-card-time">
                    {new Date(msg.sent_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
