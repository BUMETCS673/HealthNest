import { useState, useEffect, useRef } from "react";
import {
  Bell,
  ChevronDown,
  ChevronLeft,
  LogOut,
  Search,
  User,
} from "lucide-react";
import { appointmentsApi, providersApi } from "./lib/appointmentsApi";
import AppointmentModal from "./AppointmentModal";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDocClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target))
        setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

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
        // Distinct provider names from appointment history
        const seenNames = new Set();
        const mine = [];
        for (const appt of [...appointments].reverse()) {
          if (!seenNames.has(appt.provider_name)) {
            seenNames.add(appt.provider_name);
            mine.push({
              provider_name: appt.provider_name,
              specialty: appt.specialty || null,
              location: appt.location || null,
            });
          }
        }
        setMyProviders(mine);

        // All providers not already in the patient's history
        const available = providers
          .filter((p) => {
            const fullName = [p.title, p.first_name, p.last_name]
              .filter(Boolean)
              .join(" ");
            return !seenNames.has(fullName);
          })
          .map((p) => ({
            provider_name: [p.title, p.first_name, p.last_name]
              .filter(Boolean)
              .join(" "),
            specialty: p.specialty || null,
            location: null,
          }));
        setNewProviders(available);

        // If the patient has no history, jump straight to find-a-doctor view
        if (mine.length === 0) setShowFindDoctor(true);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
      <nav className="bp-nav">
        <div className="bp-nav-left">
          <span className="bp-logo">
            <u>HealthNest</u>
          </span>
          {navLinks.map((link) => (
            <button
              key={link}
              className={`bp-nav-link ${link === "Appointments" ? "active" : ""}`}
              onClick={() => {
                if (link === "Dashboard") onNavigate?.("dashboard");
                if (link === "Appointments") onNavigate?.("appointments");
              }}
            >
              {link}
            </button>
          ))}
        </div>
        <div className="bp-nav-right">
          <button className="bp-icon-btn">
            <Bell size={20} />
          </button>
          <div className="bp-user-wrap" ref={menuRef}>
            <button
              type="button"
              className="bp-user"
              onClick={() => setMenuOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <div className="bp-avatar">
                <User size={16} />
              </div>
              <div>
                <span className="bp-user-name">{fullName}</span>
                <span className="bp-user-role">Patient</span>
              </div>
              <ChevronDown size={16} />
            </button>
            {menuOpen && (
              <div className="bp-user-menu" role="menu">
                <button
                  type="button"
                  className="bp-user-menu-item"
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
                      key={p.provider_name}
                      provider={p}
                      onClick={() => setSelectedProvider(p.provider_name)}
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
                          key={p.provider_name}
                          provider={p}
                          onClick={() => setSelectedProvider(p.provider_name)}
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
          providerName={selectedProvider}
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
      <p className="bp-card-name">{provider.provider_name}</p>
      {provider.specialty && (
        <span className="bp-card-badge">{provider.specialty}</span>
      )}
      {provider.location && <p className="bp-card-loc">{provider.location}</p>}
    </button>
  );
}
