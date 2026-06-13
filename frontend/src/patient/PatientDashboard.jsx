// AI-USAGE SUMMARY
// Tools: Claude Code, Opus 4.7
// Overall AI Contribution: ~55%
// AI-Assisted Areas: Original dashboard layout and summary cards (Claude Code); Opus 4.7 wired the Pulse AI entry points (top-nav button, banner CTA, floating FAB) into the new PulseProvider hooks.
// Human Contributions: Owned the data-source decisions (appointments + labs), the role-based gating, and the decision to wire ALL three Pulse entry points to the same drawer state so promotion to the full workspace is one click anywhere on the page.
import { useEffect, useState } from "react";
import "./PatientDashboard.css";
import {
  appointmentsApi,
  apptToDisplayRow,
  providersApi,
} from "../lib/appointmentsApi";
import {
  Calendar,
  Pill,
  Activity,
  ChevronRight,
  Plus,
  MessageCircleQuestion,
  Stethoscope,
} from "lucide-react";
import { labResultsApi } from "../lib/labResultsApi";
import PatientLabResultsPage from "./PatientLabResultsPage";
import LabResultDetail from "../labresults/LabResultDetail";
import { usePulse } from "../pulse/PulseProvider";
import { useMessages } from "../messages/MessagesProvider";
import AppointmentDetailModal from "../appointments/AppointmentDetailModal";
import AppointmentModal from "../appointments/AppointmentModal";
import TopNav from "../components/TopNav";
import Footer from "../components/Footer";
import { authApi } from "../lib/authApi";

function formatRole(role) {
  if (!role) return "Patient";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function deriveCurrentUser(user) {
  const metadata = user?.user_metadata ?? {};
  const firstName = metadata.first_name?.trim() || "";
  const lastName = metadata.last_name?.trim() || "";
  const fullName =
    [firstName, lastName].filter(Boolean).join(" ") || user?.email || "Patient";
  return {
    firstName: firstName || fullName.split(" ")[0] || "there",
    fullName,
    role: formatRole(metadata.role),
  };
}

const activeMed = [
  {
    name: "Lisinopril",
    dose: "10 mg",
    frequency: "Once daily",
    refillDue: "Jun 5",
  },
  {
    name: "Metformin",
    dose: "500 mg",
    frequency: "Twice daily",
    refillDue: "May 28",
  },
  {
    name: "Vitamin D3",
    dose: "2000 IU",
    frequency: "Once daily",
    refillDue: "Aug 12",
  },
];

function summarizeForCard(rows) {
  return (rows || []).slice(0, 4).map((r) => ({
    id: r.id,
    test: r.lab_name,
    result: new Date(
      r.resulted_at || r.released_at || r.created_at,
    ).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    flag: false,
  }));
}

function SummaryCard({ icon, label, value, detail, onClick }) {
  const body = (
    <>
      <div className="summ-icon">{icon}</div>
      <p className="summ-label">{label}</p>
      <p className="summ-value">{value}</p>
      {detail && <p className="summ-detail">{detail}</p>}
    </>
  );

  // Clickable cards are real buttons (keyboard + screen-reader friendly)
  // with a corner chevron hinting they navigate somewhere.
  if (onClick) {
    return (
      <button
        type="button"
        className="summ-card summ-card--clickable"
        onClick={onClick}
      >
        {body}
        <ChevronRight size={15} className="summ-arrow" />
      </button>
    );
  }

  return <div className="summ-card">{body}</div>;
}

function AccountSettings({ user, currentUser, onBack }) {
  // ── Display name edit ──
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(currentUser.fullName);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMsg, setNameMsg] = useState("");

  const handleSaveName = async () => {
    if (!nameValue.trim()) return;
    setNameSaving(true);
    setNameMsg("");
    try {
      const parts = nameValue.trim().split(" ");
      const first = parts[0] || "";
      const last = parts.slice(1).join(" ") || "";
      await authApi.updateProfile({ first_name: first, last_name: last });
      setNameMsg("Name updated.");
      setEditingName(false);
    } catch (e) {
      setNameMsg("Could not update name: " + (e.message || e));
    } finally {
      setNameSaving(false);
    }
  };

  // ── Password change ──
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState("");

  const handleChangePassword = async () => {
    setPwMsg("");
    if (!pw.current || !pw.next || !pw.confirm) {
      setPwMsg("Please fill in all password fields.");
      return;
    }
    if (pw.next !== pw.confirm) {
      setPwMsg("New passwords do not match.");
      return;
    }
    if (pw.next.length < 6) {
      setPwMsg("Password must be at least 6 characters.");
      return;
    }
    setPwSaving(true);
    try {
      await authApi.updatePassword(pw.current, pw.next);
      setPwMsg("Password updated successfully.");
      setPwOpen(false);
      setPw({ current: "", next: "", confirm: "" });
    } catch (e) {
      setPwMsg("Could not update password: " + (e.message || e));
    } finally {
      setPwSaving(false);
    }
  };

  // ── Biometric ──
  const [authBusy, setAuthBusy] = useState(false);
  const [authMsg, setAuthMsg] = useState("");

  const handleEnableBiometric = async () => {
    setAuthBusy(true);
    setAuthMsg("");
    try {
      await authApi.enableBiometricLogin();
      setAuthMsg("Biometric login enabled for this device.");
    } catch (e) {
      setAuthMsg("Unable to enable biometric login: " + (e.message || e));
    } finally {
      setAuthBusy(false);
    }
  };

  return (
    <section className='acct-page'>
      <div className='acct-header'>
        <h3 className='acct-title'>Account Settings</h3>
        <button className='dash-view-all' onClick={onBack}>
          Back to dashboard
        </button>
      </div>

      {/* ── Profile ── */}
      <div className='acct-section'>
        <p className='acct-section-label'>Profile</p>

        <div className='acct-row'>
          <span className='acct-row-key'>Name</span>
          {editingName ? (
            <div className='acct-inline-edit'>
              <input
                className='acct-input'
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                autoFocus
              />
              <div className='acct-inline-actions'>
                <button
                  className='acct-btn-primary'
                  onClick={handleSaveName}
                  disabled={nameSaving}>
                  {nameSaving ? "Saving…" : "Save"}
                </button>
                <button
                  className='acct-btn-ghost'
                  onClick={() => {
                    setEditingName(false);
                    setNameValue(currentUser.fullName);
                    setNameMsg("");
                  }}>
                  Cancel
                </button>
              </div>
              {nameMsg && <p className='acct-msg'>{nameMsg}</p>}
            </div>
          ) : (
            <div className='acct-row-value-wrap'>
              <span className='acct-row-value'>{currentUser.fullName}</span>
              <button
                className='acct-edit-link'
                onClick={() => setEditingName(true)}>
                Edit
              </button>
            </div>
          )}
        </div>

        <div className='acct-row'>
          <span className='acct-row-key'>Role</span>
          <span className='acct-row-value'>{currentUser.role}</span>
        </div>

        <div className='acct-row'>
          <span className='acct-row-key'>Email</span>
          <span className='acct-row-value'>
            {user?.email || "Not available"}
          </span>
        </div>
      </div>

      {/* ── Password ── */}
      <div className='acct-section'>
        <p className='acct-section-label'>Password</p>
        {!pwOpen ? (
          <button
            className='acct-btn-outline'
            onClick={() => {
              setPwOpen(true);
              setPwMsg("");
            }}>
            Change password
          </button>
        ) : (
          <div className='acct-pw-form'>
            <div className='acct-field'>
              <label className='acct-field-label'>Current password</label>
              <input
                className='acct-input'
                type='password'
                value={pw.current}
                onChange={(e) =>
                  setPw((p) => ({ ...p, current: e.target.value }))
                }
              />
            </div>
            <div className='acct-field'>
              <label className='acct-field-label'>New password</label>
              <input
                className='acct-input'
                type='password'
                value={pw.next}
                onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
              />
            </div>
            <div className='acct-field'>
              <label className='acct-field-label'>Confirm new password</label>
              <input
                className='acct-input'
                type='password'
                value={pw.confirm}
                onChange={(e) =>
                  setPw((p) => ({ ...p, confirm: e.target.value }))
                }
              />
            </div>
            {pwMsg && <p className='acct-msg'>{pwMsg}</p>}
            <div className='acct-inline-actions'>
              <button
                className='acct-btn-primary'
                onClick={handleChangePassword}
                disabled={pwSaving}>
                {pwSaving ? "Updating…" : "Update password"}
              </button>
              <button
                className='acct-btn-ghost'
                onClick={() => {
                  setPwOpen(false);
                  setPw({ current: "", next: "", confirm: "" });
                  setPwMsg("");
                }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Authentication ── */}
      <div className='acct-section'>
        <p className='acct-section-label'>Authentication</p>
        <p className='acct-section-desc'>
          Enable biometric/passkey login for faster sign-in on supported
          devices.
        </p>
        <button
          className='acct-btn-primary'
          onClick={handleEnableBiometric}
          disabled={authBusy}>
          {authBusy ? "Setting up…" : "Enable biometric login"}
        </button>
        {authMsg && <p className='acct-msg'>{authMsg}</p>}
      </div>
    </section>
  );
}

export default function PatientDashboard({
  user,
  onNavigate,
  onSignOut,
  pageData,
}) {
  const currentUser = deriveCurrentUser(user);
  const pulse = usePulse();
  const [upcomingAppoint, setUpcomingAppoint] = useState([]);
  const [providerUserMap, setProviderUserMap] = useState({});
  const [rescheduleAppt, setRescheduleAppt] = useState(null);

  const loadUpcoming = () => {
    appointmentsApi
      .getAppointments()
      .then((data) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const upcoming = data
          .map(apptToDisplayRow)
          .filter((a) => {
            const d = new Date(
              a.raw.provider_availability?.available_date + "T00:00:00",
            );
            return d >= today && a.status === "scheduled";
          })
          .slice(0, 3);
        setUpcomingAppoint(upcoming);
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadUpcoming();
    // Map provider_id → the provider's auth user id, so messaging opens the
    // right conversation regardless of the appointment payload.
    providersApi
      .getCareTeam()
      .then((team) => {
        const map = {};
        for (const p of team || []) {
          if (p.id && p.user_id) map[p.id] = p.user_id;
        }
        setProviderUserMap(map);
      })
      .catch(() => {});
  }, []);

  const [view, setView] = useState(() => {
    if (pageData?.intent === "account-settings") return "account-settings";
    if (pageData?.intent === "labs" && pageData.labResultId)
      return "lab-detail";
    if (pageData?.intent === "labs") return "labs";
    return "home";
  });

  // A labs navigation can arrive while the dashboard is already mounted (e.g.
  // clicking a lab notification from the dashboard). Switch to the labs view
  // when a new labs intent comes in. `_nav` is a nonce so repeat clicks re-fire.
  const labsNonce =
    pageData?.intent === "labs" ? (pageData._nav ?? "labs") : null;
  const [appliedLabsNonce, setAppliedLabsNonce] = useState(labsNonce);
  if (labsNonce && labsNonce !== appliedLabsNonce) {
    setAppliedLabsNonce(labsNonce);
    setView(pageData.labResultId ? "lab-detail" : "labs");
  }

  const [activeLabId, setActiveLabId] = useState(
    () => pageData?.labResultId ?? null,
  );
  const [labRows, setLabRows] = useState([]);

  useEffect(() => {
    labResultsApi
      .list({ limit: 10 })
      .then((rows) => setLabRows(rows || []))
      .catch(() => setLabRows([]));
  }, [view]);

  const labResult = summarizeForCard(labRows);

  const today = new Date();
  const dateFormat = today.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const hour = today.getHours();
  let greetingMes = "Good evening";
  if (hour >= 6 && hour < 12) greetingMes = "Good morning";
  else if (hour >= 12 && hour < 18) greetingMes = "Good afternoon";

  const { unreadCount: unreadMessages, openThread, openDrawer } = useMessages();
  const [detailAppt, setDetailAppt] = useState(null);

  // Open the appointment's provider conversation in the global messaging drawer.
  const messageProvider = (appt) => {
    setDetailAppt(null);
    const uid = appt?.providerUserId || providerUserMap[appt?.raw?.provider_id];
    if (uid) openThread(uid);
    openDrawer();
  };

  const rescheduleProvider = (appt) => {
    setDetailAppt(null);
    setRescheduleAppt({
      id: appt.id,
      providerId: appt.raw?.provider_id,
      providerName: appt.doctor,
    });
  };

  const cancelProvider = (appt) => {
    setDetailAppt(null);
    appointmentsApi
      .cancelAppointment(appt.id)
      .then(loadUpcoming)
      .catch(() => {});
  };

  const navOption = [
    "Dashboard",
    "Appointments",
    "My Care Team",
    "Records",
    "Messages",
    "Pulse AI",
  ];

  return (
    <div className='p-dash'>
      <TopNav
        links={navOption.map((o) =>
          o === "Messages" ? { label: o, badge: unreadMessages } : o,
        )}
        activeKey={
          view === "home"
            ? "Dashboard"
            : view === "labs" || view === "lab-detail"
              ? "Records"
              : null
        }
        onLogoClick={() => setView("home")}
        onSelect={(label) => {
          if (label === "Dashboard") setView("home");
          else if (label === "Records") setView("labs");
          else if (label === "Appointments") onNavigate?.("appointments");
          else if (label === "My Care Team") onNavigate?.("care-team");
          else if (label === "Pulse AI") onNavigate?.("pulse");
          else if (label === "Messages") onNavigate?.("messages");
        }}
        userName={currentUser.fullName}
        userRole={currentUser.role}
        onAccountSettings={() => setView("account-settings")}
        onSignOut={onSignOut}
      />

      <main className='dash-main'>
        {view === "account-settings" && (
          <AccountSettings
            user={user}
            currentUser={currentUser}
            onBack={() => setView("home")}
          />
        )}

        {view === "labs" && (
          <PatientLabResultsPage
            onBack={() => setView("home")}
            onOpenDetail={(id) => {
              setActiveLabId(id);
              setView("lab-detail");
            }}
          />
        )}

        {view === "lab-detail" && activeLabId && (
          <LabResultDetail
            labResultId={activeLabId}
            onBack={() => setView("labs")}
          />
        )}

        {view !== "home" ? null : (
          <>
            <div className='dash-header'>
              <div>
                <p className='dash-date'>{dateFormat}</p>
                <h1 className='dash-greeting'>
                  {greetingMes}, {currentUser.firstName}
                </h1>
              </div>
              <button
                className='dash-book-btn'
                onClick={() => onNavigate?.("booking")}>
                <Plus size={16} /> Book Appointment
              </button>
            </div>

            <div className='dash-sumcard'>
              <SummaryCard
                icon={<Calendar size={16} />}
                label='Next Appointment'
                value={
                  upcomingAppoint[0]
                    ? `${upcomingAppoint[0].month} ${upcomingAppoint[0].day}`
                    : "None"
                }
                detail={
                  upcomingAppoint[0]
                    ? `${upcomingAppoint[0].doctor}${upcomingAppoint[0].specialty ? ` · ${upcomingAppoint[0].specialty}` : ""}`
                    : "No upcoming appointments"
                }
                onClick={() =>
                  upcomingAppoint[0]
                    ? onNavigate?.("appointment-detail", {
                        appointmentId: upcomingAppoint[0].id,
                        appointment: upcomingAppoint[0],
                      })
                    : onNavigate?.("appointments")
                }
              />
              {/* Medications are still demo data (no meds backend yet);
                  the soonest refill in that list is Metformin's. */}
              <SummaryCard
                icon={<Pill size={16} />}
                label="Active Medications"
                value={String(activeMed.length)}
                detail={`Next refill ${activeMed[1].refillDue}`}
              />
              <SummaryCard
                icon={<Activity size={16} />}
                label="Recent Labs"
                value={String(labRows.length)}
                detail={
                  labResult[0]
                    ? `Latest: ${labResult[0].test} · ${labResult[0].result}`
                    : "No results yet"
                }
                onClick={() => setView("labs")}
              />
            </div>

            <div className='dash-middle'>
              <div className='dash-card'>
                <div className='dash-card-header'>
                  <h3 className='dash-card-title'>Upcoming Appointments</h3>
                  <button
                    className='dash-view-all'
                    onClick={() => onNavigate?.("appointments")}>
                    View all
                  </button>
                </div>
                {upcomingAppoint.length === 0 && (
                  <p className='dash-appt-empty'>No upcoming appointments.</p>
                )}
                {upcomingAppoint.map((appt) => (
                  <button
                    key={appt.id}
                    className='dash-appt-row'
                    onClick={() => setDetailAppt(appt)}>
                    <div className='dash-appt-date'>
                      <span className='dash-appt-month'>{appt.month}</span>
                      <span className='dash-appt-day'>{appt.day}</span>
                    </div>
                    <div className='dash-appt-divider' />
                    <div className='dash-appt-info'>
                      <p className='dash-appt-doctor'>{appt.doctor}</p>
                      <p className='dash-appt-specialty'>{appt.specialty}</p>
                    </div>
                    <div className='dash-appt-time'>
                      <span>{appt.time}</span>
                      <Stethoscope size={14} />
                    </div>
                    <ChevronRight size={16} className='dash-appt-arrow' />
                  </button>
                ))}
              </div>

              <div className='dash-sidebar'>
                <div className='dash-card'>
                  <div className='dash-card-header'>
                    <h3 className='dash-card-title'>Active Medications</h3>
                    <button className='dash-view-all'>View all</button>
                  </div>
                  {activeMed.map((med) => (
                    <div key={med.name} className='dash-med-row'>
                      <div>
                        <p className='dash-med-name'>{med.name}</p>
                        <p className='dash-med-detail'>
                          {med.dose} · {med.frequency}
                        </p>
                      </div>
                      <span className='dash-med-refill'>{med.refillDue}</span>
                    </div>
                  ))}
                </div>

                <div className='dash-card'>
                  <div className='dash-card-header'>
                    <h3 className='dash-card-title'>Recent Labs</h3>
                    <button
                      className='dash-view-all'
                      onClick={() => setView("labs")}>
                      View all
                    </button>
                  </div>
                  {labResult.map((lab) => (
                    <div key={lab.test} className='dash-lab-row'>
                      <div className='dash-lab-name-wrap'>
                        {lab.flag && <span className='dash-lab-dot'></span>}
                        <p
                          className={
                            lab.flag ? "dash-lab-name flagged" : "dash-lab-name"
                          }>
                          {lab.test}
                        </p>
                      </div>
                      <span
                        className={
                          lab.flag
                            ? "dash-lab-status flagged"
                            : "dash-lab-status"
                        }>
                        {lab.result}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className='dash-ai-banner'>
              <div className='dash-ai-icon'>
                <MessageCircleQuestion size={22} />
              </div>
              <div className='dash-ai-text'>
                <p className='dash-ai-title'>
                  Pulse AI — built around your care
                </p>
                <p className='dash-ai-detail'>
                  Ask about your upcoming visit, medication interactions, lab
                  results, or anything on your mind.
                </p>
              </div>
              <button
                className='dash-ai-btn'
                onClick={() => pulse.openDrawer()}>
                <MessageCircleQuestion size={16} /> Ask Pulse
              </button>
            </div>
          </>
        )}
      </main>

      {detailAppt && (
        <AppointmentDetailModal
          appt={detailAppt}
          onClose={() => setDetailAppt(null)}
          onMessage={messageProvider}
          onReschedule={rescheduleProvider}
          onCancel={cancelProvider}
        />
      )}

      {rescheduleAppt && (
        <AppointmentModal
          rescheduleId={rescheduleAppt.id}
          providerId={rescheduleAppt.providerId}
          providerName={rescheduleAppt.providerName}
          onClose={() => setRescheduleAppt(null)}
          onBooked={() => {
            setRescheduleAppt(null);
            loadUpcoming();
          }}
        />
      )}

      <Footer
        role="patient"
        onNavigate={(target) => {
          if (target === "dashboard") setView("home");
          else if (target === "records") setView("labs");
          else if (target === "appointments") onNavigate?.("appointments");
          else if (target === "messages") onNavigate?.("messages");
          else onNavigate?.(target);
        }}
      />
    </div>
  );
}
