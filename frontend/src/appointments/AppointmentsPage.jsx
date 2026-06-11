// AI-USAGE SUMMARY
// Tools: Claude Code (Opus 4.8)
// Overall AI Contribution: ~60%
// AI-Assisted Areas: Appointment-list refactor to the nested provider/availability
//   schema (apptToDisplayRow mapping, isUpcoming/isPast helpers, status badges)
//   and the unread-messages nav badge.
// Human Contributions: Owned the data-shape decisions, applied and reviewed each
//   change, and updated the Jest tests.
// Notes: Validated via `npm run build`, the jest suite, and manual testing.
import { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  Plus,
  RefreshCw,
  Stethoscope,
  X,
} from "lucide-react";
import { appointmentsApi, apptToDisplayRow } from "../lib/appointmentsApi";
import AppointmentModal from "./AppointmentModal";
import { useMessages } from "../messages/MessagesProvider";
import TopNav from "../components/TopNav";
import "./AppointmentsPage.css";

const STATUS_META = {
  pending: { label: "Pending", cls: "ap-status--pending" },
  scheduled: { label: "Scheduled", cls: "ap-status--scheduled" },
  completed: { label: "Completed", cls: "ap-status--completed" },
  cancelled: { label: "Cancelled", cls: "ap-status--cancelled" },
  no_show: { label: "No-Show", cls: "ap-status--no-show" },
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

  useEffect(() => {
    fetchAppointments();
  }, []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isUpcoming = (a) => {
    const dateStr = a.raw.provider_availability?.available_date;
    if (!dateStr) return false;
    return (
      new Date(dateStr + "T00:00:00") >= today &&
      (a.status === "scheduled" || a.status === "pending")
    );
  };

  const isPast = (a) => {
    const dateStr = a.raw.provider_availability?.available_date;
    if (!dateStr) return false;
    return (
      new Date(dateStr + "T00:00:00") < today ||
      a.status === "cancelled" ||
      a.status === "completed"
    );
  };

  const upcomingCount = appointments.filter(isUpcoming).length;

  const filtered = appointments.filter((a) => {
    if (activeTab === "Upcoming") return isUpcoming(a);
    if (activeTab === "Past") return isPast(a);
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
    setRescheduleProvider({
      id: appt.raw.provider_id,
      name: `${appt.raw.providers.first_name} ${appt.raw.providers.last_name}`,
    });
  };

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
    <div className="ap-page">
      {/* Nav bar */}
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

      {/* Main content */}
      <main className="ap-main">
        {/* Page header */}
        <div className="ap-header">
          <div>
            <h1 className="ap-title">My Appointments</h1>
            <p className="ap-sub">{upcomingCount} upcoming</p>
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
                <span className="ap-tab-count">{upcomingCount}</span>
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
              const canAct = ["scheduled", "pending"].includes(appt.status);
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
                    <p className="ap-card-detail">{appt.specialty}</p>
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
        <button
          type="button"
          className="ap-logo"
          onClick={() => onNavigate?.("dashboard")}
        >
          <u>HealthNest</u>
        </button>
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
          providerId={rescheduleProvider?.id}
          providerName={rescheduleProvider?.name}
          onClose={() => {
            setRescheduleId(null);
            setRescheduleProvider(null);
          }}
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
