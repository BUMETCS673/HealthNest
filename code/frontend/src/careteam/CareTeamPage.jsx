// AI-USAGE SUMMARY
// Tools: Claude Code (Opus 4.8)
// Overall AI Contribution: ~80%
// AI-Assisted Areas: Built the My Care Team page (#38) — fetches the patient's
//   active care-team providers from /providers/care-team, renders provider cards
//   with Message/Book quick actions (reusing AppointmentModal), and an empty
//   state. Wires the shared TopNav + Footer.
// Human Contributions: Product decisions (which actions appear, empty-state copy),
//   review, and verification.
// Notes: Validated via `npm run build`, jest, and manual testing.
import { useState, useEffect } from "react";
import { User, MessageSquare, CalendarPlus, Search } from "lucide-react";
import { providersApi } from "../lib/appointmentsApi";
import AppointmentModal from "../appointments/AppointmentModal";
import { useMessages } from "../messages/MessagesProvider";
import TopNav from "../components/TopNav";
import Footer from "../components/Footer";
import "./CareTeamPage.css";

const NAV_LINKS = [
  "Dashboard",
  "Appointments",
  "My Care Team",
  "Records",
  "Messages",
  "Pulse AI",
];

function providerName(p) {
  return [p.title, p.first_name, p.last_name].filter(Boolean).join(" ");
}

export default function CareTeamPage({
  user,
  onNavigate,
  onSignOut,
  onAccountSettings,
}) {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const { unreadCount } = useMessages();

  const fullName =
    `${user?.user_metadata?.first_name || ""} ${user?.user_metadata?.last_name || ""}`.trim() ||
    user?.email ||
    "Patient";

  useEffect(() => {
    providersApi
      .getCareTeam()
      .then((data) => setProviders(data || []))
      .catch(() => setProviders([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className='ct-page'>
      <TopNav
        links={NAV_LINKS.map((l) =>
          l === "Messages" ? { label: l, badge: unreadCount } : l,
        )}
        activeKey='My Care Team'
        onLogoClick={() => onNavigate?.("dashboard")}
        onSelect={(label) => {
          if (label === "Dashboard") onNavigate?.("dashboard");
          else if (label === "Appointments") onNavigate?.("appointments");
          else if (label === "My Care Team") onNavigate?.("care-team");
          else if (label === "Records") onNavigate?.("labs");
          else if (label === "Messages") onNavigate?.("messages");
          else if (label === "Pulse AI") onNavigate?.("pulse");
        }}
        userName={fullName}
        userRole='Patient'
        onAccountSettings={onAccountSettings}
        onSignOut={onSignOut}
      />

      <main className='ct-main'>
        <div className='ct-header'>
          <h1 className='ct-title'>My Care Team</h1>
          <p className='ct-sub'>
            Providers currently associated with your account.
          </p>
        </div>

        {loading ? (
          <div className='ct-loading'>Loading your care team…</div>
        ) : providers.length === 0 ? (
          <div className='ct-empty'>
            <User size={40} />
            <p>You don&apos;t have any care team members yet.</p>
            <button
              className='ct-empty-btn'
              onClick={() => onNavigate?.("booking")}>
              <Search size={16} /> Find a Doctor
            </button>
          </div>
        ) : (
          <div className='ct-grid'>
            {providers.map((p) => (
              <div key={p.id} className='ct-card'>
                <div className='ct-card-avatar'>
                  <User size={28} />
                </div>
                <p className='ct-card-name'>{providerName(p)}</p>
                {p.specialty && (
                  <span className='ct-card-badge'>{p.specialty}</span>
                )}
                <div className='ct-card-actions'>
                  <button
                    className='ct-action ct-action--ghost'
                    onClick={() =>
                      onNavigate?.(
                        "messages",
                        p.user_id ? { openContactId: p.user_id } : undefined,
                      )
                    }>
                    <MessageSquare size={15} /> Message
                  </button>
                  <button
                    className='ct-action ct-action--filled'
                    onClick={() =>
                      setSelectedProvider({ id: p.id, name: providerName(p) })
                    }>
                    <CalendarPlus size={15} /> Book
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {selectedProvider && (
        <AppointmentModal
          providerId={selectedProvider.id}
          providerName={selectedProvider.name}
          onClose={() => setSelectedProvider(null)}
          onBooked={() => {
            setSelectedProvider(null);
            onNavigate?.("appointments");
          }}
        />
      )}

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
