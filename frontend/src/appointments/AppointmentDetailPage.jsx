/*
AI-USAGE SUMMARY
Tools: Claude Code (Fable 5)
Overall AI Contribution: ~85%
AI-Assisted Areas: Built the single-appointment detail page (hero, status badge,
notes editing, reschedule/cancel actions) reusing the appointments-page design
language and the existing appointmentsApi/AppointmentModal plumbing.
Human Contributions: Requested that each dashboard appointment link serve its
own purpose (rows open this detail page, "View all" opens the list) and
reviewed the interaction flow.
*/
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Calendar,
  Clock,
  RefreshCw,
  Stethoscope,
  X,
} from "lucide-react";
import { appointmentsApi, apptToDisplayRow } from "../lib/appointmentsApi";
import AppointmentModal from "./AppointmentModal";
import { useMessages } from "../messages/MessagesProvider";
import TopNav from "../components/TopNav";
import "./AppointmentsPage.css";
import "./AppointmentDetailPage.css";

const STATUS_META = {
  pending: { label: "Pending", cls: "ap-status--pending" },
  scheduled: { label: "Scheduled", cls: "ap-status--scheduled" },
  completed: { label: "Completed", cls: "ap-status--completed" },
  cancelled: { label: "Cancelled", cls: "ap-status--cancelled" },
  no_show: { label: "No-Show", cls: "ap-status--no-show" },
};

export default function AppointmentDetailPage({
  user,
  onNavigate,
  onSignOut,
  appointmentId,
  initialAppointment = null,
}) {
  const [appt, setAppt] = useState(initialAppointment);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [reschedule, setReschedule] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState("");
  const [notesDraft, setNotesDraft] = useState(
    initialAppointment?.raw?.notes || "",
  );
  const [editingNotes, setEditingNotes] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  const fullName =
    `${user?.user_metadata?.first_name || ""} ${user?.user_metadata?.last_name || ""}`.trim() ||
    user?.email ||
    "Patient";
  const { unreadCount } = useMessages();

  const refresh = async () => {
    try {
      const data = await appointmentsApi.getAppointments();
      const fresh = data
        .map(apptToDisplayRow)
        .find((a) => a.id === appointmentId);
      if (fresh) {
        setAppt(fresh);
        setNotesDraft(fresh.raw?.notes || "");
        setNotFound(false);
      } else if (!initialAppointment) {
        setNotFound(true);
      }
    } catch {
      // keep whatever we were handed via navigation
      if (!initialAppointment) setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!appointmentId) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentId]);

  const handleCancel = async () => {
    setCancelling(true);
    setActionError("");
    try {
      await appointmentsApi.cancelAppointment(appointmentId);
      setConfirmCancel(false);
      await refresh();
    } catch {
      setActionError("Could not cancel. Please try again.");
    } finally {
      setCancelling(false);
    }
  };

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    setActionError("");
    try {
      await appointmentsApi.editAppointmentNotes(
        appointmentId,
        notesDraft.trim() || null,
      );
      setEditingNotes(false);
      await refresh();
    } catch {
      setActionError("Could not save notes. Please try again.");
    } finally {
      setSavingNotes(false);
    }
  };

  const meta = appt ? STATUS_META[appt.status] || STATUS_META.scheduled : null;
  const canAct = appt && ["scheduled", "pending"].includes(appt.status);

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

      <main className="ap-main">
        <button
          type="button"
          className="ad-back"
          onClick={() => onNavigate?.("appointments")}
        >
          <ArrowLeft size={14} /> All Appointments
        </button>

        {loading && !appt ? (
          <div className="ap-loading">Loading appointment…</div>
        ) : notFound || !appt ? (
          <div className="ap-empty">
            <Calendar size={40} />
            <p>Appointment not found.</p>
            <button
              className="ap-book-btn"
              onClick={() => onNavigate?.("appointments")}
            >
              Back to appointments
            </button>
          </div>
        ) : (
          <>
            <div className="ad-hero">
              <div className="ad-hero-date">
                <span className="ap-card-month">{appt.month}</span>
                <span className="ap-card-day">{appt.day}</span>
              </div>

              <div className="ad-hero-info">
                <div className="ad-hero-top">
                  <h1 className="ad-title">{appt.doctor}</h1>
                  <span className={`ap-status ${meta.cls}`}>{meta.label}</span>
                </div>
                {appt.specialty && (
                  <p className="ad-specialty">
                    <Stethoscope size={14} /> {appt.specialty}
                  </p>
                )}
                <p className="ad-when">
                  <Calendar size={14} /> {appt.date}
                  <Clock size={14} style={{ marginLeft: 12 }} /> {appt.time}
                </p>
              </div>

              {canAct && (
                <div className="ad-actions">
                  {confirmCancel ? (
                    <>
                      <span className="ap-cancel-prompt">
                        Cancel this appointment?
                      </span>
                      <button
                        className="ap-action ap-action--cancel"
                        onClick={handleCancel}
                        disabled={cancelling}
                      >
                        <X size={14} />
                        {cancelling ? "Cancelling…" : "Yes, cancel"}
                      </button>
                      <button
                        className="ap-action ap-action--reschedule"
                        onClick={() => setConfirmCancel(false)}
                      >
                        Keep
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="ap-action ap-action--reschedule"
                        onClick={() => setReschedule(true)}
                      >
                        <RefreshCw size={14} /> Reschedule
                      </button>
                      <button
                        className="ap-action ap-action--cancel"
                        onClick={() => {
                          setActionError("");
                          setConfirmCancel(true);
                        }}
                      >
                        <X size={14} /> Cancel
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {actionError && <p className="ap-cancel-error">{actionError}</p>}

            <section className="ad-section">
              <div className="ad-section-head">
                <h2>Visit Notes</h2>
                {canAct && !editingNotes && (
                  <button
                    type="button"
                    className="ad-link-btn"
                    onClick={() => setEditingNotes(true)}
                  >
                    Edit notes
                  </button>
                )}
              </div>

              {editingNotes ? (
                <>
                  <textarea
                    className="ad-notes-input"
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    placeholder="Anything you'd like your provider to know before the visit…"
                    rows={4}
                    aria-label="Visit notes"
                  />
                  <div className="ad-notes-actions">
                    <button
                      type="button"
                      className="ap-action ap-action--reschedule"
                      onClick={handleSaveNotes}
                      disabled={savingNotes}
                    >
                      {savingNotes ? "Saving…" : "Save notes"}
                    </button>
                    <button
                      type="button"
                      className="ad-link-btn"
                      onClick={() => {
                        setEditingNotes(false);
                        setNotesDraft(appt.raw?.notes || "");
                      }}
                    >
                      Discard
                    </button>
                  </div>
                </>
              ) : (
                <p className="ad-notes">
                  {appt.raw?.notes || "No notes for this visit."}
                </p>
              )}
            </section>
          </>
        )}
      </main>

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

      {reschedule && appt && (
        <AppointmentModal
          rescheduleId={appt.id}
          providerId={appt.raw?.provider_id}
          providerName={appt.doctor}
          onClose={() => setReschedule(false)}
          onBooked={() => {
            setReschedule(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}
