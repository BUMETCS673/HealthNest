/**
 * AI-USAGE SUMMARY
 * Tools: Opus 4.7
 * Overall AI Contribution: ~65%
 * AI-Assisted Areas: Drafted the workspace layout (sidebar + thread + composer) and the integration into the app's shared HealthNest top nav.
 * Human Contributions: Replaced the bespoke `pulse-ws-top` header with the same `.ap-nav` markup AppointmentsPage uses so Pulse feels like a first-class HealthNest surface instead of a separate sub-app; the per-page "+ New chat" affordance lives in the sidebar (single source of truth) rather than the top bar.
 */
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  ChevronDown,
  LogOut,
  User as UserIcon,
} from "lucide-react";
import { usePulse } from "./PulseProvider";
import ConversationSidebar from "./ConversationSidebar";
import ConversationThread from "./ConversationThread";
import Composer from "./Composer";
import { pulseApi } from "../lib/pulseApi";
import "../appointments/AppointmentsPage.css";
import "./PulseWorkspace.css";

const NAV_LINKS = [
  "Dashboard",
  "Appointments",
  "My Care Team",
  "Records",
  "Messages",
  "Pulse AI",
];

export default function PulseWorkspace({ user, onNavigate, onSignOut }) {
  const {
    conversations,
    activeId,
    messages,
    streaming,
    streamingId,
    error,
    send,
    loadConversation,
    newConversation,
    refreshConversations,
  } = usePulse();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const mountedRef = useRef(false);

  const fullName =
    `${user?.user_metadata?.first_name || ""} ${user?.user_metadata?.last_name || ""}`.trim() ||
    user?.email ||
    "Patient";

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDocClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    refreshConversations();
    if (activeId && !streaming) {
      loadConversation(activeId);
    }
  }, []);

  const handleNavClick = (link) => {
    if (link === "Dashboard") onNavigate?.("dashboard");
    else if (link === "Appointments") onNavigate?.("appointments");
    else if (link === "Records") onNavigate?.("labs");
    else if (link === "Pulse AI") onNavigate?.("pulse");
  };

  return (
    <div className="ap-page">
      <nav className="ap-nav">
        <div className="ap-nav-left">
          <span className="ap-logo">
            <u>HealthNest</u>
          </span>
          {NAV_LINKS.map((link) => (
            <button
              key={link}
              className={`ap-nav-link ${link === "Pulse AI" ? "active" : ""}`}
              onClick={() => handleNavClick(link)}
            >
              {link}
            </button>
          ))}
        </div>
        <div className="ap-nav-right">
          <button className="ap-icon-btn">
            <Bell size={20} />
          </button>
          <div className="ap-user-wrap" ref={menuRef}>
            <button
              type="button"
              className="ap-user"
              onClick={() => setMenuOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <div className="ap-avatar">
                <UserIcon size={16} />
              </div>
              <div>
                <span className="ap-user-name">{fullName}</span>
                <span className="ap-user-role">Patient</span>
              </div>
              <ChevronDown size={16} />
            </button>
            {menuOpen && (
              <div className="ap-user-menu" role="menu">
                <button
                  type="button"
                  className="ap-user-menu-item"
                  onClick={() => { setMenuOpen(false); onSignOut?.(); }}
                  role="menuitem"
                >
                  <LogOut size={14} />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <div className="pulse-ws-grid">
        <ConversationSidebar
          conversations={conversations}
          activeId={activeId}
          onSelect={loadConversation}
          onNew={newConversation}
        />

        <main className="pulse-ws-main">
          <div className="pulse-ws-thread">
            <ConversationThread
              messages={messages}
              streaming={streaming}
              streamingId={streamingId}
              onNavigate={onNavigate}
            />
          </div>
          {error && <div className="pulse-error">{error}</div>}
          <div className="pulse-ws-composer">
            <Composer onSend={send} disabled={streaming} />
          </div>
        </main>
      </div>
    </div>
  );
}
