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
import { useEffect, useRef } from "react";
import { useDfa } from "./DfaProvider";
import ConversationSidebar from "./ConversationSidebar";
import ConversationThread from "./ConversationThread";
import Composer from "./Composer";
import TopNav from "../components/TopNav";
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
    if (mountedRef.current) return;
    mountedRef.current = true;
    refreshConversations();
    if (activeId && !streaming) {
      loadConversation(activeId);
    }
  }, []);

  const handleNavClick = (link) => {
    // Provider sub-pages are internal `view` states inside DoctorDashboard, not
    // App-level routes. Navigate back to the dashboard route and pass the target
    // view so DoctorDashboard opens on it (it remounts on leaving Pulse).
    if (link === "Dashboard") onNavigate?.("dashboard", { providerView: "home" });
    else if (link === "Schedule")
      onNavigate?.("dashboard", { providerView: "schedule" });
    else if (link === "Patient Records")
      onNavigate?.("dashboard", { providerView: "labs" });
    else if (link === "Messages")
      onNavigate?.("dashboard", { providerView: "messages" });
    else if (link === "Pulse AI") onNavigate?.("dfa-pulse");
  };

  return (
    <div className='ap-page'>
      <TopNav
        links={NAV_LINKS}
        activeKey="Pulse AI"
        onLogoClick={() => onNavigate?.("dashboard", { providerView: "home" })}
        onSelect={handleNavClick}
        userName={fullName}
        userRole={specialty}
        onSignOut={onSignOut}
      />

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
