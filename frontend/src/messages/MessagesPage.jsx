/**
 * AI-USAGE SUMMARY
 * Tools: Claude Code (Opus 4.8)
 * Overall AI Contribution: ~50%
 * AI-Assisted Areas: Drafted the page shell (shared HealthNest nav + unread
 *   badge) that hosts the shared MessagesView body.
 * Human Contributions: Integration into the app routing/nav and verification.
 * Notes: Validated via `npm run build`, jest, and manual testing.
 */
import { useMessages } from "./MessagesProvider";
import MessagesView from "./MessagesView";
import TopNav from "../components/TopNav";
import "./MessagesPage.css";
import Footer from "../components/Footer";

export default function MessagesPage({
  user,
  onNavigate,
  onSignOut,
  initialContactId,
}) {
  const { unreadCount } = useMessages();

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
    <div className='mp-page'>
      <TopNav
        links={navLinks.map((l) =>
          l === "Messages" ? { label: l, badge: unreadCount } : l,
        )}
        activeKey='Messages'
        onLogoClick={() => onNavigate?.("dashboard")}
        onSelect={(label) => {
          if (label === "Dashboard") onNavigate?.("dashboard");
          else if (label === "Appointments") onNavigate?.("appointments");
          else if (label === "My Care Team") onNavigate?.("care-team");
          else if (label === "Records") onNavigate?.("labs");
          else if (label === "Pulse AI") onNavigate?.("pulse");
          else if (label === "Messages") onNavigate?.("messages");
        }}
        userName={fullName}
        userRole='Patient'
        onSignOut={onSignOut}
      />

      <main className='mp-main'>
        <MessagesView myId={user?.id} initialContactId={initialContactId} />
      </main>
      <Footer
        role='patient'
        onNavigate={(target) => {
          if (target === "records") onNavigate?.("labs");
          else onNavigate?.(target);
        }}
      />
    </div>
  );
}
