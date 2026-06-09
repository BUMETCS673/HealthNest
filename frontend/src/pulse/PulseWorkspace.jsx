/**
 * AI-USAGE SUMMARY
 * Tools: Opus 4.7
 * Overall AI Contribution: ~65%
 * AI-Assisted Areas: Drafted the workspace layout (sidebar + thread + composer) and the integration into the app's shared HealthNest top nav.
 * Human Contributions: Replaced the bespoke `pulse-ws-top` header with the same `.ap-nav` markup AppointmentsPage uses so Pulse feels like a first-class HealthNest surface instead of a separate sub-app; the per-page "+ New chat" affordance lives in the sidebar (single source of truth) rather than the top bar.
 */
import { useEffect, useRef } from "react";
import { usePulse } from "./PulseProvider";
import ConversationSidebar from "./ConversationSidebar";
import ConversationThread from "./ConversationThread";
import Composer from "./Composer";
import { pulseApi } from "../lib/pulseApi";
import { useMessages } from "../messages/MessagesProvider";
import TopNav from "../components/TopNav";
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

  const { unreadCount } = useMessages();
  const mountedRef = useRef(false);

  const fullName =
    `${user?.user_metadata?.first_name || ""} ${user?.user_metadata?.last_name || ""}`.trim() ||
    user?.email ||
    "Patient";

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
    else if (link === "Messages") onNavigate?.("messages");
    else if (link === "Pulse AI") onNavigate?.("pulse");
  };

  return (
    <div className="ap-page">
      <TopNav
        links={NAV_LINKS.map((l) =>
          l === "Messages" ? { label: l, badge: unreadCount } : l,
        )}
        activeKey="Pulse AI"
        onLogoClick={() => onNavigate?.("dashboard")}
        onSelect={handleNavClick}
        userName={fullName}
        userRole="Patient"
        onSignOut={onSignOut}
      />

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
