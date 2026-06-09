/**
 * AI-USAGE SUMMARY
 * Tools: Claude Code (Opus 4.8)
 * Overall AI Contribution: ~50%
 * AI-Assisted Areas: Drafted the page shell (shared HealthNest nav + unread
 *   badge) that hosts the shared MessagesView body.
 * Human Contributions: Integration into the app routing/nav and verification.
 * Notes: Validated via `npm run build`, jest, and manual testing.
 */
import { useState, useEffect, useRef } from "react";
import { Bell, ChevronDown, LogOut, User } from "lucide-react";
import { useMessages } from "./MessagesProvider";
import MessagesView from "./MessagesView";
import "../appointments/AppointmentsPage.css"; // reuse the shared .ap-nav top bar
import "./MessagesPage.css";

export default function MessagesPage({ user, onNavigate, onSignOut }) {
  const { unreadCount } = useMessages();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
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
      {/* Top nav (shared .ap-nav styling) */}
      <nav className="ap-nav">
        <div className="ap-nav-left">
          <span className="ap-logo">
            <u>HealthNest</u>
          </span>
          {navLinks.map((link) => (
            <button
              key={link}
              className={`ap-nav-link ${link === "Messages" ? "active" : ""}`}
              onClick={() => {
                if (link === "Dashboard") onNavigate?.("dashboard");
                else if (link === "Appointments") onNavigate?.("appointments");
                else if (link === "Messages") onNavigate?.("messages");
                else if (link === "Pulse AI") onNavigate?.("pulse");
              }}
            >
              {link}
              {link === "Messages" && unreadCount > 0 && (
                <span className="mp-nav-badge">{unreadCount}</span>
              )}
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
                <User size={16} />
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
                  onClick={() => {
                    setMenuOpen(false);
                    onSignOut?.();
                  }}
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

      <main className="mp-main">
        <MessagesView myId={user?.id} />
      </main>
    </div>
  );
}
