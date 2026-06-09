// AI-USAGE SUMMARY
// Tools: Claude Code (Opus 4.8)
// Overall AI Contribution: ~60%
// AI-Assisted Areas: Provider-selection refactor to provider_id + nested
//   providers (history vs directory dedupe) and the unread-messages nav badge.
// Human Contributions: Business rules for "Your Doctors" vs new providers;
//   applied/verified the changes and updated tests.
// Notes: Validated via `npm run build`, jest, and manual testing.
import { useState, useEffect } from "react";
import { ChevronLeft, Search, User } from "lucide-react";
import { appointmentsApi, providersApi } from "../lib/appointmentsApi";
import AppointmentModal from "../appointments/AppointmentModal";
import { useMessages } from "../messages/MessagesProvider";
import TopNav from "../components/TopNav";
import "./BookingPage.css";

export default function BookingPage({
  user,
  onNavigate,
  onSignOut,
  appointments: passedAppointments = null,
}) {
  const [myProviders, setMyProviders] = useState([]);
  const [newProviders, setNewProviders] = useState([]);
  const [showFindDoctor, setShowFindDoctor] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [loading, setLoading] = useState(true);

  const fullName =
    `${user?.user_metadata?.first_name || ""} ${user?.user_metadata?.last_name || ""}`.trim() ||
    user?.email ||
    "Patient";

  useEffect(() => {
    Promise.all([
      passedAppointments
        ? Promise.resolve(passedAppointments.map((a) => a.raw ?? a))
        : appointmentsApi.getAppointments().catch(() => []),
      providersApi.getProviders().catch(() => []),
    ])
      .then(([appointments, providers]) => {
        // Distinct providers from appointment history (keyed by provider_id)
        const seenIds = new Set();
        const mine = [];
        for (const appt of [...appointments].reverse()) {
          if (appt.provider_id && !seenIds.has(appt.provider_id)) {
            seenIds.add(appt.provider_id);
            mine.push({
              id: appt.provider_id,
              name: appt.providers
                ? [
                    appt.providers.title,
                    appt.providers.first_name,
                    appt.providers.last_name,
                  ]
                    .filter(Boolean)
                    .join(" ")
                : "Your provider",
              specialty: appt.providers?.specialty || null,
            });
          }
        }
        setMyProviders(mine);

        // Providers the patient hasn't seen yet
        const available = providers
          .filter((p) => !seenIds.has(p.id))
          .map((p) => ({
            id: p.id,
            name: [p.title, p.first_name, p.last_name]
              .filter(Boolean)
              .join(" "),
            specialty: p.specialty || null,
          }));
        setNewProviders(available);

        if (mine.length === 0) setShowFindDoctor(true);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const { unreadCount } = useMessages();

  const navLinks = [
    "Dashboard",
    "Appointments",
    "My Care Team",
    "Records",
    "Messages",
    "Pulse AI",
  ];

  return (
    <div className="bp-page">
      {/* Nav */}
      <TopNav
        links={navLinks.map((l) =>
          l === "Messages" ? { label: l, badge: unreadCount } : l,
        )}
        activeKey="Appointments"
        onLogoClick={() => onNavigate?.("dashboard")}
        onSelect={(label) => {
          if (label === "Dashboard") onNavigate?.("dashboard");
          else if (label === "Appointments") onNavigate?.("appointments");
          else if (label === "Records") onNavigate?.("labs");
          else if (label === "Pulse AI") onNavigate?.("pulse");
          else if (label === "Messages") onNavigate?.("messages");
        }}
        userName={fullName}
        userRole="Patient"
        onSignOut={onSignOut}
      />

      <main className="bp-main">
        <button
          className="bp-back"
          onClick={() => onNavigate?.("appointments")}
        >
          <ChevronLeft size={16} /> Back to Appointments
        </button>

        <div className="bp-header">
          <h1 className="bp-title">Book an Appointment</h1>
          <p className="bp-sub">
            Choose a provider to see their available times.
          </p>
        </div>

        {loading ? (
          <div className="bp-loading">Loading…</div>
        ) : (
          <>
            {myProviders.length > 0 && (
              <section className="bp-section">
                <h2 className="bp-section-title">Your Doctors</h2>
                <div className="bp-grid">
                  {myProviders.map((p) => (
                    <ProviderCard
                      key={p.id}
                      provider={p}
                      onClick={() => setSelectedProvider(p)}
                    />
                  ))}
                </div>
              </section>
            )}

            <section className="bp-section">
              {!showFindDoctor ? (
                <button
                  className="bp-find-btn"
                  onClick={() => setShowFindDoctor(true)}
                >
                  <Search size={16} />
                  Find a New Doctor
                </button>
              ) : (
                <>
                  <h2 className="bp-section-title">Find a New Doctor</h2>
                  {newProviders.length === 0 ? (
                    <p className="bp-empty">
                      No new providers available right now.
                    </p>
                  ) : (
                    <div className="bp-grid">
                      {newProviders.map((p) => (
                        <ProviderCard
                          key={p.id}
                          provider={p}
                          onClick={() => setSelectedProvider(p)}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </section>
          </>
        )}
      </main>

      <footer className="bp-footer">
        <span className="bp-logo">
          <u>HealthNest</u>
        </span>
        <p className="bp-footer-tag">
          Coordinated care across clinics, built for patients and providers.
        </p>
      </footer>
      <div className="bp-copyright">
        © 2026 HealthNest Technologies, Inc. All rights reserved.
      </div>

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
    </div>
  );
}

function ProviderCard({ provider, onClick }) {
  return (
    <button className="bp-card" onClick={onClick}>
      <div className="bp-card-avatar">
        <User size={28} />
      </div>
      <p className="bp-card-name">{provider.name}</p>
      {provider.specialty && (
        <span className="bp-card-badge">{provider.specialty}</span>
      )}
    </button>
  );
}
