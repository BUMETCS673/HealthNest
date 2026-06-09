/**
 * AI-USAGE SUMMARY
 * Tools: Claude Sonnet 4.6
 * Overall AI Contribution: ~70%
 * AI-Assisted Areas: Mirrored PulseWorkspace.jsx for the doctor-facing assistant,
 * replacing usePulse with useDfa, updating nav links to match the Doctor Dashboard,
 * and passing the DFA-specific welcome message to ConversationThread.
 * Human Contributions: Verified nav links match DoctorDashboard, confirmed context
 * shape is compatible with reused sidebar/thread/composer components.
 */
import { useEffect, useRef, useState } from "react";
import { Bell, ChevronDown, LogOut, User as UserIcon } from "lucide-react";
import { useDfa } from "./DfaProvider";
import ConversationSidebar from "./ConversationSidebar";
import ConversationThread from "./ConversationThread";
import Composer from "./Composer";
import "../appointments/AppointmentsPage.css";
import "./PulseWorkspace.css";

const NAV_LINKS = [
  "Dashboard",
  "Schedule",
  "Patient Records",
  "Messages",
  "Pulse AI",
];

export default function DfaWorkspace({ user, onNavigate, onSignOut }) {
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
  } = useDfa();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const mountedRef = useRef(false);

  const fullName =
    `${user?.user_metadata?.first_name || ""} ${user?.user_metadata?.last_name || ""}`.trim() ||
    user?.email ||
    "Provider";

  const specialty =
    user?.user_metadata?.specialty ||
    user?.user_metadata?.department ||
    "Provider";

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDocClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target))
        setMenuOpen(false);
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
    else if (link === "Patient Records") onNavigate?.("labs");
    else if (link === "Messages") onNavigate?.("messages");
    else if (link === "Pulse AI") onNavigate?.("dfa-pulse");
  };

  return (
    <div className='ap-page'>
      <nav className='ap-nav'>
        <div className='ap-nav-left'>
          <span className='ap-logo'>
            <u>HealthNest</u>
          </span>
          {NAV_LINKS.map((link) => (
            <button
              key={link}
              className={`ap-nav-link ${link === "Pulse AI" ? "active" : ""}`}
              onClick={() => handleNavClick(link)}>
              {link}
            </button>
          ))}
        </div>
        <div className='ap-nav-right'>
          <button className='ap-icon-btn'>
            <Bell size={20} />
          </button>
          <div className='ap-user-wrap' ref={menuRef}>
            <button
              type='button'
              className='ap-user'
              onClick={() => setMenuOpen((o) => !o)}
              aria-haspopup='menu'
              aria-expanded={menuOpen}>
              <div className='ap-avatar'>
                <UserIcon size={16} />
              </div>
              <div>
                <span className='ap-user-name'>{fullName}</span>
                <span className='ap-user-role'>{specialty}</span>
              </div>
              <ChevronDown size={16} />
            </button>
            {menuOpen && (
              <div className='ap-user-menu' role='menu'>
                <button
                  type='button'
                  className='ap-user-menu-item'
                  onClick={() => {
                    setMenuOpen(false);
                    onSignOut?.();
                  }}
                  role='menuitem'>
                  <LogOut size={14} />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <div className='pulse-ws-grid'>
        <ConversationSidebar
          conversations={conversations}
          activeId={activeId}
          onSelect={loadConversation}
          onNew={newConversation}
        />

        <main className='pulse-ws-main'>
          <div className='pulse-ws-thread'>
            <ConversationThread
              messages={messages}
              streaming={streaming}
              streamingId={streamingId}
              onNavigate={onNavigate}
              welcomeMessage="Ask me about today's schedule, patient summaries, or anything clinical. I only surface data for your care team."
            />
          </div>
          {error && <div className='pulse-error'>{error}</div>}
          <div className='pulse-ws-composer'>
            <Composer onSend={send} disabled={streaming} />
          </div>
        </main>
      </div>
    </div>
  );
}
