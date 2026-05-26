import { useState, useEffect, useRef } from "react";
import {
  Bell,
  Calendar,
  ChevronDown,
  Clock,
  LogOut,
  MapPin,
  Plus,
  RefreshCw,
  Stethoscope,
  User,
  X,
} from "lucide-react";
import { appointmentsApi, apptToDisplayRow } from "./lib/appointmentsApi";
import { authApi } from "./lib/authApi";
import AppointmentModal from "./AppointmentModal";
import "./AppointmentsPage.css";

const STATUS_META = {
  scheduled: { label: "Scheduled", cls: "ap-status--scheduled" },
  cancelled: { label: "Cancelled", cls: "ap-status--cancelled" },
  completed: { label: "Completed", cls: "ap-status--completed" },
  rescheduled: { label: "Rescheduled", cls: "ap-status--rescheduled" },
};

const TABS = ["Upcoming", "Past", "All"];

export default function AppointmentsPage({ user, onNavigate, onSignOut }) {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Upcoming");
  const [rescheduleId, setRescheduleId] = useState(null);
  const [rescheduleProvider, setRescheduleProvider] = useState(null);
  const [confirmCancelId, setConfirmCancelId] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [cancelError, setCancelError] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDocClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  const firstName =
    user?.user_metadata?.first_name || user?.email?.split("@")[0] || "there";
  const fullName =
    `${user?.user_metadata?.first_name || ""} ${user?.user_metadata?.last_name || ""}`.trim() ||
    user?.email ||
    "Patient";

  const fetchAppointments = () => {
    appointmentsApi
      .getAppointments()
      .then((data) => setAppointments(data.map(apptToDisplayRow)))
      .catch(() => setAppointments([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAppointments(); }, []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const filtered = appointments.filter((a) => {
    const d = new Date(a.raw.appointment_date + "T00:00:00");
    const isUpcoming = d >= today && a.status === "scheduled";
    const isPast =
      d < today || a.status === "cancelled" || a.status === "completed";
    if (activeTab === "Upcoming") return isUpcoming;
    if (activeTab === "Past") return isPast;
    return true;
  });

  const handleCancel = async (id) => {
    setCancelling(id);
    setConfirmCancelId(null);
    try {
      await appointmentsApi.cancelAppointment(id);
      fetchAppointments();
    } catch {
      setCancelError(id);
    } finally {
      setCancelling(null);
    }
  };

  const handleReschedule = (appt) => {
    setRescheduleId(appt.id);
    setRescheduleProvider(appt.raw?.provider_name ?? null);
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
    <div className="ap-page">
      {/* Nav bar */}
      <nav className="ap-nav">
        <div className="ap-nav-left">
          <span className="ap-logo">
            <u>HealthNest</u>
          </span>
          {navLinks.map((link) => (
            <button
              key={link}
              className={`ap-nav-link ${link === "Appointments" ? "active" : ""}`}
              onClick={() => {
                if (link === "Dashboard") onNavigate?.("dashboard");
                if (link === "Appointments") onNavigate?.("appointments");
              }}
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

      {/* Main content */}
      <main className="ap-main">
        {/* Page header */}
        <div className="ap-header">
          <div>
            <h1 className="ap-title">My Appointments</h1>
            <p className="ap-sub">
              {appointments.filter((a) => a.status === "scheduled").length}{" "}
              upcoming
            </p>
          </div>
          <button
            className="ap-book-btn"
            onClick={() => onNavigate?.("booking", { appointments })}
          >
            <Plus size={16} /> Book Appointment
          </button>
        </div>

        {/* Tab selector */}
        <div className="ap-tabs">
          {TABS.map((tab) => (
            <button
              key={tab}
              className={`ap-tab ${activeTab === tab ? "active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
              {tab === "Upcoming" && (
                <span className="ap-tab-count">
                  {
                    appointments.filter((a) => {
                      const d = new Date(a.raw.appointment_date + "T00:00:00");
                      return d >= today && a.status === "scheduled";
                    }).length
                  }
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Appointment list */}
        {loading ? (
          <div className="ap-loading">Loading appointments…</div>
        ) : filtered.length === 0 ? (
          <div className="ap-empty">
            <Calendar size={40} />
            <p>
              {activeTab === "Upcoming"
                ? "No upcoming appointments."
                : "No appointments to show."}
            </p>
            {activeTab === "Upcoming" && (
              <button
                className="ap-book-btn"
                onClick={() => onNavigate?.("booking", { appointments })}
              >
                <Plus size={16} /> Book your first appointment
              </button>
            )}
          </div>
        ) : (
          <div className="ap-list">
            {filtered.map((appt) => {
              const meta = STATUS_META[appt.status] || STATUS_META.scheduled;
              const canAct = appt.status === "scheduled";
              return (
                <div key={appt.id} className="ap-card">
                  {/* Date badge */}
                  <div className="ap-card-date">
                    <span className="ap-card-month">{appt.month}</span>
                    <span className="ap-card-day">{appt.day}</span>
                  </div>

                  {/* Divider */}
                  <div className="ap-card-divider" />

                  {/* Info */}
                  <div className="ap-card-info">
                    <div className="ap-card-top">
                      <p className="ap-card-doctor">{appt.doctor}</p>
                      <span className={`ap-status ${meta.cls}`}>
                        {meta.label}
                      </span>
                    </div>
                    <p className="ap-card-detail">
                      {[appt.specialty, appt.address]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <p className="ap-card-time">
                      <Clock size={13} />
                      {appt.time}
                      {appt.specialty && (
                        <>
                          <Stethoscope size={13} style={{ marginLeft: 8 }} />
                          {appt.specialty}
                        </>
                      )}
                    </p>
                    {appt.address && (
                      <p className="ap-card-loc">
                        <MapPin size={13} />
                        {appt.address}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  {canAct && (
                    <div className="ap-card-actions">
                      {confirmCancelId === appt.id ? (
                        <>
                          <span className="ap-cancel-prompt">
                            Cancel this appointment?
                          </span>
                          <button
                            className="ap-action ap-action--cancel"
                            onClick={() => handleCancel(appt.id)}
                            disabled={cancelling === appt.id}
                          >
                            <X size={14} />
                            {cancelling === appt.id
                              ? "Cancelling…"
                              : "Yes, cancel"}
                          </button>
                          <button
                            className="ap-action ap-action--reschedule"
                            onClick={() => setConfirmCancelId(null)}
                          >
                            Keep
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="ap-action ap-action--reschedule"
                            onClick={() => handleReschedule(appt)}
                          >
                            <RefreshCw size={14} /> Reschedule
                          </button>
                          <button
                            className="ap-action ap-action--cancel"
                            onClick={() => {
                              setCancelError(null);
                              setConfirmCancelId(appt.id);
                            }}
                          >
                            <X size={14} /> Cancel
                          </button>
                        </>
                      )}
                      {cancelError === appt.id && (
                        <p className="ap-cancel-error">
                          Could not cancel. Please try again.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="ap-footer">
        <span className="ap-logo">
          <u>HealthNest</u>
        </span>
        <p className="ap-footer-tag">
          Coordinated care across clinics, built for patients and providers.
        </p>
      </footer>
      <div className="ap-copyright">
        © 2026 HealthNest Technologies, Inc. All rights reserved.
      </div>

      {/* Reschedule modal */}
      {rescheduleId && (
        <AppointmentModal
          rescheduleId={rescheduleId}
          providerName={rescheduleProvider}
          onClose={() => { setRescheduleId(null); setRescheduleProvider(null); }}
          onBooked={() => {
            setRescheduleId(null);
            setRescheduleProvider(null);
            fetchAppointments();
          }}
        />
      )}
    </div>
  );
}
