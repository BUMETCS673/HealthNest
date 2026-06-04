/*
/**
 * AI-USAGE SUMMARY
 * Tools: Opus 4.7
 * Overall AI Contribution: ~70%
 * AI-Assisted Areas: Generated the editable entries grid, the per-field meta inputs, the per-entry diff calculation that builds the minimal patch payload, the sticky action footer, the eyebrow + MRN-pill header, and the summary stat tiles.
 * Human Contributions: Workflow design (save vs release-with-implicit-patch), the manual-entry-required gating on release, the patient-name resolution wiring, and the decision to mirror server state into a local editable copy with explicit diffing rather than a controlled-from-server pattern.
 */

/*
AI-USAGE SUMMARY
Tools: Opus 4.7
Overall AI Contribution: ~20%
AI-Assisted Areas: Added an "Enable biometric login" menu item to the account menu and wired it to `authApi.enableBiometricLogin` with basic alerts.
Human Contributions: Kept existing dashboard structure and chose menu placement; verified non-blocking UX.
*/

import { useEffect, useRef, useState } from "react";
/*
AI-USAGE SUMMARY
Model: ChatGPT-5
Overall AI Contribution: ~10%
AI-Assisted Areas: Added an "Enable biometric login" menu item to the account menu and wired it to `authApi.enableBiometricLogin` with basic alerts.
Human Contributions: Kept existing dashboard structure and chose menu placement; verified non-blocking UX.
*/

import "./DoctorDashboard.css";
import {
  Bell,
  ChevronDown,
  LogOut,
  Search,
  FileSignature,
  MessageSquare,
  Users,
  User,
  FileText,
  AlertCircle,
  MessageCircleQuestion,
  FlaskConical,
} from "lucide-react";
import LabResultsPage from "./LabResultsPage";
import LabResultReview from "./LabResultReview";
import { authApi } from "./lib/authApi";

// For specialty display/default setting
function formatRole(role) {
  if (!role) {
    return "Provider";
  }

  if (role === "provider") {
    return "Provider";
  }

  return role.charAt(0).toUpperCase() + role.slice(1);
}

function formatSpecialty(specialty) {
  if (!specialty) {
    return "";
  }

  return specialty.charAt(0).toUpperCase() + specialty.slice(1);
}

function getCurrUser(user) {
  const metadata = user?.user_metadata ?? {};

  const firstName = metadata.first_name?.trim() || "";
  const lastName = metadata.last_name?.trim() || "";

  const fullName =
    [firstName, lastName].filter(Boolean).join(" ") ||
    user?.email ||
    "Provider";

  const initials =
    [firstName[0], lastName[0]].filter(Boolean).join("").toUpperCase() ||
    fullName.slice(0, 2).toUpperCase();

  const specialty =
    metadata.specialty ||
    metadata.provider_specialty ||
    metadata.department ||
    "";

  const role = formatRole(metadata.role);

  return {
    firstName: firstName || fullName.split(" ")[0] || "Doctor",
    lastName,
    fullName,
    specialty: formatSpecialty(specialty),
    role,
    initials,
  };
}

// Temp data until backend data connect

const patientAlerts = [];

const unsignEn = [];

function VisitOverviewDrawer({ visit, onClose, onOpenFullChart }) {
  const patient = visit.patient || {};
  const appointment = visit.appointment || {};

  const recentHistory = visit.recentHistory || [];
  const activeProblems = visit.activeProblems || [];
  const medications = visit.medications || [];
  const labs = visit.labs || [];
  const openIssues = visit.openIssues || [];
  const missingSections = visit.missingSections || [];

  return (
    <div className='visit-overview-backdrop'>
      <aside className='visit-overview-drawer' aria-label='Visit overview'>
        <div className='visit-overview-header'>
          <div className='visit-overview-patient-header'>
            <div className='visit-overview-avatar'>{patient.initials}</div>

            <div>
              <div className='visit-overview-name-line'>
                <h2>{patient.name}</h2>
                <span>{patient.mrn}</span>
                <span>DOB {patient.dateOfBirth}</span>
              </div>

              <p className='visit-overview-meta'>
                {appointment.time || "TBD"} · {appointment.visitType}
              </p>
            </div>
          </div>

          <button
            type='button'
            className='visit-overview-close'
            onClick={onClose}
            aria-label='Close visit overview'>
            ×
          </button>
        </div>

        <section className='visit-overview-section'>
          <h3>Recent History</h3>

          <div className='visit-history-list'>
            {recentHistory.map((item) => (
              <div key={item.date + item.title} className='visit-history-card'>
                <div className='visit-history-date'>
                  <p>{item.date}</p>
                  <span>{item.provider}</span>
                </div>

                <div className='visit-history-detail'>
                  <p>{item.title}</p>
                  <span>{item.detail}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className='visit-overview-section'>
          <h3>Active Problems</h3>

          <div className='visit-problem-list'>
            {activeProblems.map((problem) => (
              <div key={problem.name} className='visit-problem-row'>
                <div className='visit-problem-left'>
                  <span className='visit-problem-dot'></span>

                  <div>
                    <p>{problem.name}</p>
                    <span>
                      {problem.code} · Since {problem.since}
                    </span>
                  </div>
                </div>

                <span className='visit-problem-status'>{problem.status}</span>
              </div>
            ))}
          </div>
        </section>

        <section className='visit-overview-section'>
          <h3>Medications</h3>

          <div className='visit-table-wrap'>
            <table className='visit-overview-table'>
              <thead>
                <tr>
                  <th>Medication</th>
                  <th>Dose</th>
                  <th>Frequency</th>
                  <th>Prescriber</th>
                </tr>
              </thead>

              <tbody>
                {medications.map((med) => (
                  <tr key={med.medication}>
                    <td>
                      {med.flagged && <span className='visit-med-flag'>!</span>}
                      {med.medication}
                    </td>
                    <td>{med.dose}</td>
                    <td>{med.frequency}</td>
                    <td>{med.prescriber}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className='visit-overview-section'>
          <h3>Last Labs</h3>

          <div className='visit-table-wrap'>
            <table className='visit-overview-table'>
              <thead>
                <tr>
                  <th>Test</th>
                  <th>Result</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {labs.map((lab) => (
                  <tr key={lab.test}>
                    <td>{lab.test}</td>
                    <td>{lab.result}</td>
                    <td>{lab.date}</td>
                    <td>{lab.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className='visit-overview-section'>
          <h3>Open Issues</h3>

          <div className='visit-issues-list'>
            {openIssues.map((issue) => (
              <div key={issue.text} className='visit-issue-card'>
                <span className={`visit-issue-badge visit-issue-${issue.tone}`}>
                  {issue.level}
                </span>

                <span className='visit-issue-text'>{issue.text}</span>
              </div>
            ))}
          </div>
        </section>

        {missingSections.length > 0 && (
          <section className='visit-overview-section'>
            <h3>Missing Information</h3>

            <ul className='visit-overview-list visit-overview-warning-list'>
              {missingSections.map((section) => (
                <li key={section}>{section}</li>
              ))}
            </ul>
          </section>
        )}

        <div className='visit-overview-actions'>
          <p className='visit-overview-source'>{visit.generatedFrom}</p>

          <div className='visit-overview-action-buttons'>
            <button
              type='button'
              className='doc-btn-sign'
              onClick={() => onOpenFullChart(visit)}>
              Open Full Chart
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

export default function DoctorDashboard({ user, onSignOut }) {
  const currentUser = getCurrUser(user);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const [view, setView] = useState("home");
  const [activeLabId, setActiveLabId] = useState(null);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [selectedChart, setSelectedChart] = useState(null);
  const [chartTab, setChartTab] = useState("overview");
  const [visitOverviewItems, setVisitOverviewItems] = useState([]);
  const [visitOverviewError, setVisitOverviewError] = useState("");
  const [visitOverviewLoading, setVisitOverviewLoading] = useState(false);

  const getAuthHeaders = () => {
    const session = authApi.getSession();

    if (!session?.access_token) {
      return {};
    }

    return {
      Authorization: `Bearer ${session.access_token}`,
    };
  };

  // closes the profile menu if the user clicks outside of it.
  useEffect(() => {
    if (!menuOpen) return undefined;

    const onDocClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  useEffect(() => {
    const loadVisitOverviews = async () => {
      setVisitOverviewError("");

      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/providers/visit-overviews`,
          {
            headers: getAuthHeaders(),
          },
        );

        if (!response.ok) {
          throw new Error("Unable to load visit overview list.");
        }

        const data = await response.json();
        setVisitOverviewItems(data);
      } catch (error) {
        setVisitOverviewError(
          error.message || "Unable to load visit overview list.",
        );
      }
    };

    loadVisitOverviews();
  }, []);

  const today = new Date();

  const dateFormat = today.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const badgeDateFormat = today.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  const hour = today.getHours();
  let greetingMes = "Good evening";

  if (hour >= 6 && hour < 12) {
    greetingMes = "Good morning";
  } else if (hour >= 12 && hour < 18) {
    greetingMes = "Good afternoon";
  }

  //dashboard counts
  const unreadMessages = 0;
  const signNotesCount = 0;
  const inboxCount = 0;

  const todayPatientsCount = visitOverviewItems.length;

  const seenPatientCount = 0;

  const pendingPatientCount = visitOverviewItems.length;

  const unsignEnCount = unsignEn.length;

  const urgentEncounterCount = unsignEn.filter((encounter) => {
    return encounter.urgent;
  }).length;

  const activeAlertCount = patientAlerts.length;
  const criticalAlertCount = 0;

  const navOption = [
    "Dashboard",
    "Schedule",
    "Patient Records",
    "Messages",
    "Pulse AI",
  ];

  const openVisitOverview = async (appointmentId) => {
    if (!appointmentId) {
      return;
    }

    setVisitOverviewLoading(true);
    setVisitOverviewError("");

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/providers/visit-overview/${appointmentId}`,
        {
          headers: getAuthHeaders(),
        },
      );

      if (!response.ok) {
        throw new Error("Unable to load visit overview.");
      }

      const data = await response.json();
      setSelectedVisit(data);
    } catch (error) {
      setVisitOverviewError(error.message || "Unable to load visit overview.");
    } finally {
      setVisitOverviewLoading(false);
    }
  };

  const openFullChart = (visit) => {
    setSelectedChart(visit);
    setChartTab("overview");
    setSelectedVisit(null);
    setView("full-chart");
  };

  return (
    <div className='d-dash'>
      {/* Navigation bar */}
      <nav className='dash-nav'>
        <div className='dash-nav-left'>
          <span className='dash-logo'>
            <u>HealthNest</u>
          </span>

          {navOption.map((option) => {
            const isLabsView = view !== "home";
            const isActive =
              (option === "Patient Records" && isLabsView) ||
              (option === "Dashboard" && !isLabsView);
            const buttonClass = isActive
              ? "doc-nav-link active"
              : "doc-nav-link";

            const showMessageBadge =
              option === "Messages" && unreadMessages > 0;

            const onClick = () => {
              if (option === "Dashboard") setView("home");
              else if (option === "Patient Records") setView("labs");
            };

            return (
              <button key={option} className={buttonClass} onClick={onClick}>
                {option}

                {showMessageBadge && (
                  <span className='doc-badge'>{unreadMessages}</span>
                )}
              </button>
            );
          })}
        </div>

        <div className='dash-nav-right'>
          <button className='doc-icon-btn' aria-label='Notifications'>
            <Bell size={20} />
          </button>

          <div className='doc-user-wrap' ref={menuRef}>
            <button
              type='button'
              className='doc-user'
              onClick={() => setMenuOpen((open) => !open)}
              aria-haspopup='menu'
              aria-expanded={menuOpen}>
              <div className='doc-avatar'>{currentUser.initials}</div>

              <div className='doc-user-info'>
                <span className='doc-user-name'>{currentUser.firstName}</span>
                <span className='doc-user-role'>
                  {currentUser.specialty || currentUser.role}
                </span>
              </div>

              <ChevronDown size={16} />
            </button>

            {menuOpen && (
              <div className='doc-user-menu' role='menu'>
                <button
                  type='button'
                  className='doc-user-menu-item'
                  onClick={async () => {
                    setMenuOpen(false);
                    try {
                      const session = authApi.getSession();
                      if (!session?.access_token) {
                        alert("Passkey already enabled for this account.");
                        return;
                      }
                      await authApi.enableBiometricLogin();
                      alert("Biometric login enabled for this device.");
                    } catch (e) {
                      alert(
                        "Unable to enable biometric login: " + (e.message || e),
                      );
                    }
                  }}
                  role='menuitem'>
                  <User size={14} />
                  Enable Biometric Login
                </button>

                <button
                  type='button'
                  className='doc-user-menu-item'
                  onClick={() => {
                    setMenuOpen(false);
                  }}
                  role='menuitem'>
                  <User size={14} />
                  Account Settings
                </button>

                <button
                  type='button'
                  className='doc-user-menu-item'
                  onClick={() => {
                    setMenuOpen(false);
                    onSignOut();
                  }}
                  role='menuitem'>
                  <User size={14} />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className='doc-main'>
        {view === "labs" && (
          <LabResultsPage
            onBack={() => setView("home")}
            onOpenReview={(id) => {
              setActiveLabId(id);
              setView("lab-review");
            }}
          />
        )}

        {view === "full-chart" && selectedChart && (
          <div className='patient-record-page'>
            <button
              type='button'
              className='patient-record-back'
              onClick={() => {
                setSelectedChart(null);
                setView("home");
              }}>
              ← All Patients
            </button>

            <section className='patient-record-hero'>
              <div className='patient-record-left'>
                <div className='patient-record-avatar'>
                  {selectedChart.patient?.initials || "PT"}
                </div>

                <div>
                  <div className='patient-record-name-row'>
                    <h1>{selectedChart.patient?.name || "Unknown Patient"}</h1>
                    <span>
                      MRN {selectedChart.patient?.mrn || "Unavailable"}
                    </span>
                  </div>

                  <p className='patient-record-meta'>
                    DOB {selectedChart.patient?.dateOfBirth || "Unavailable"} ·
                    Last visit{" "}
                    {selectedChart.appointment?.date || "Unavailable"}
                  </p>

                  <p className='patient-record-summary'>
                    {selectedChart.appointment?.visitType || "Visit Overview"} ·{" "}
                    {selectedChart.appointment?.status || "Status unavailable"}
                  </p>
                </div>
              </div>

              <div className='patient-record-actions'>
                <button type='button' className='patient-record-secondary'>
                  Message
                </button>
              </div>
            </section>

            <div className='patient-record-tabs'>
              <button
                type='button'
                className={`patient-record-tab ${
                  chartTab === "overview" ? "active" : ""
                }`}
                onClick={() => setChartTab("overview")}>
                Overview
              </button>

              <button
                type='button'
                className={`patient-record-tab ${
                  chartTab === "documents" ? "active" : ""
                }`}
                onClick={() => setChartTab("documents")}>
                Documents
              </button>

              <button
                type='button'
                className={`patient-record-tab ${
                  chartTab === "labs" ? "active" : ""
                }`}
                onClick={() => setChartTab("labs")}>
                Labs
              </button>

              <button
                type='button'
                className={`patient-record-tab ${
                  chartTab === "medications" ? "active" : ""
                }`}
                onClick={() => setChartTab("medications")}>
                Medications
              </button>
            </div>

            {chartTab === "overview" && (
              <>
                <div className='patient-record-grid'>
                  <section className='patient-record-card'>
                    <h2>Active Problems</h2>

                    {(selectedChart.activeProblems || []).length === 0 ? (
                      <p className='patient-record-empty'>
                        Active problem list unavailable.
                      </p>
                    ) : (
                      selectedChart.activeProblems.map((problem) => (
                        <div key={problem.name} className='patient-problem-row'>
                          <div>
                            <p>{problem.name}</p>
                            <span>
                              {problem.code || "No code"} · Since{" "}
                              {problem.since || "Unavailable"}
                            </span>
                          </div>

                          <span>{problem.status || "Active"}</span>
                        </div>
                      ))
                    )}
                  </section>

                  <section className='patient-record-card'>
                    <h2>Open Issues</h2>

                    {(selectedChart.openIssues || []).filter((issue) => {
                      return !issue.text
                        ?.toLowerCase()
                        .includes("no recent lab results");
                    }).length === 0 ? (
                      <p className='patient-record-empty'>
                        No open issues available.
                      </p>
                    ) : (
                      (selectedChart.openIssues || [])
                        .filter((issue) => {
                          return !issue.text
                            ?.toLowerCase()
                            .includes("no recent lab results");
                        })
                        .map((issue) => (
                          <div key={issue.text} className='patient-issue-row'>
                            <span
                              className={`patient-issue-badge ${issue.tone || ""}`}>
                              {issue.level || "Info"}
                            </span>

                            <p>{issue.text}</p>
                          </div>
                        ))
                    )}
                  </section>
                </div>

                <section className='patient-record-card patient-record-history'>
                  <h2>Visit History</h2>

                  {(selectedChart.recentHistory || []).length === 0 ? (
                    <p className='patient-record-empty'>
                      No visit history available.
                    </p>
                  ) : (
                    selectedChart.recentHistory.map((item) => (
                      <div
                        key={item.date + item.title}
                        className='patient-history-row'>
                        <div className='patient-history-date'>
                          <p>{item.date || "No date"}</p>
                          <span>{item.provider || "Provider unavailable"}</span>
                        </div>

                        <div className='patient-history-main'>
                          <span>{item.title || "Visit"}</span>
                          <p>{item.detail || "No detail available."}</p>
                        </div>
                      </div>
                    ))
                  )}
                </section>

                <section className='patient-record-card patient-record-history'>
                  <h2>Missing Information</h2>

                  {(selectedChart.missingSections || []).length === 0 ? (
                    <p className='patient-record-empty'>
                      No missing information flagged.
                    </p>
                  ) : (
                    <ul className='patient-missing-list'>
                      {selectedChart.missingSections.map((section) => (
                        <li key={section}>{section}</li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            )}

            {chartTab === "documents" && (
              <section className='patient-record-card patient-record-history'>
                <h2>Documents</h2>
                <p className='patient-record-empty'>No documents available.</p>
              </section>
            )}

            {chartTab === "labs" && (
              <section className='patient-record-card patient-record-history'>
                <h2>Lab Results</h2>

                {(selectedChart.labs || []).length === 0 ? (
                  <p className='patient-record-empty'>
                    No lab information available.
                  </p>
                ) : (
                  <table className='patient-record-table'>
                    <thead>
                      <tr>
                        <th>Test</th>
                        <th>Value</th>
                        <th>Date</th>
                        <th>Status</th>
                      </tr>
                    </thead>

                    <tbody>
                      {selectedChart.labs.map((lab) => (
                        <tr key={lab.test + lab.date}>
                          <td>{lab.test || "Unavailable"}</td>
                          <td>{lab.result || "Unavailable"}</td>
                          <td>{lab.date || "Unavailable"}</td>
                          <td>{lab.status || "Unavailable"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            )}

            {chartTab === "medications" && (
              <section className='patient-record-card patient-record-history'>
                <h2>Current Medications</h2>

                {(selectedChart.medications || []).length === 0 ? (
                  <p className='patient-record-empty'>
                    Medication information unavailable.
                  </p>
                ) : (
                  <table className='patient-record-table'>
                    <thead>
                      <tr>
                        <th>Medication</th>
                        <th>Dose</th>
                        <th>Frequency</th>
                        <th>Prescriber</th>
                      </tr>
                    </thead>

                    <tbody>
                      {selectedChart.medications.map((med) => (
                        <tr key={med.medication}>
                          <td>{med.medication || "Unavailable"}</td>
                          <td>{med.dose || "Unavailable"}</td>
                          <td>{med.frequency || "Unavailable"}</td>
                          <td>{med.prescriber || "Unavailable"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            )}
          </div>
        )}
        {view === "lab-review" && activeLabId && (
          <LabResultReview
            labResultId={activeLabId}
            onBack={() => setView("labs")}
          />
        )}
        {view !== "home" ? null : (
          <>
            {/* Header */}
            <div className='doc-header'>
              <div>
                <p className='doc-date'>{dateFormat}</p>
                <h1 className='doc-greeting'>
                  {greetingMes}, {currentUser.firstName}.
                </h1>
              </div>

              <div className='doc-header-actions'>
                <div className='doc-search'>
                  <Search size={14} />
                  <span>Quick patient lookup...</span> {/*search bar*/}
                </div>

                <button className='doc-action-btn'>
                  <FileSignature size={14} />
                  Sign Notes
                  {signNotesCount > 0 && (
                    <span className='doc-action-count'>{signNotesCount}</span>
                  )}
                </button>

                <button
                  className='doc-action-btn'
                  onClick={() => setView("labs")}>
                  <FlaskConical size={14} />
                  Lab Results
                </button>

                <button className='doc-action-btn doc-action-filled'>
                  <MessageSquare size={14} />
                  Inbox
                  {inboxCount > 0 && (
                    <span className='doc-action-count doc-action-count-light'>
                      {inboxCount}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Top summary cards */}
            <div className='doc-stats'>
              <div className='doc-stat-item'>
                <Users size={18} className='doc-stat-icon' />

                <div className='doc-stat-main'>
                  <p className='doc-stat-label'>Today's Patients</p>
                  <p className='doc-stat-value'>
                    {todayPatientsCount} scheduled
                  </p>
                </div>

                <p className='doc-stat-side'>
                  {seenPatientCount} seen · {pendingPatientCount} pending
                </p>
              </div>

              <div className='doc-stat-item'>
                <FileText size={18} className='doc-stat-icon' />

                <div className='doc-stat-main'>
                  <p className='doc-stat-label'>Unsigned Encounters</p>
                  <p className='doc-stat-value'>{unsignEnCount} notes</p>
                </div>

                {urgentEncounterCount > 0 && (
                  <p className='doc-stat-side doc-stat-side-urgent'>
                    {urgentEncounterCount} urgent
                  </p>
                )}
              </div>

              <div className='doc-stat-item'>
                <AlertCircle
                  size={18}
                  className='doc-stat-icon doc-stat-alert'
                />

                <div className='doc-stat-main'>
                  <p className='doc-stat-label'>Clinical Alerts</p>
                  <p className='doc-stat-value'>{activeAlertCount} active</p>
                </div>

                {criticalAlertCount > 0 && (
                  <p className='doc-stat-side doc-stat-side-urgent'>
                    {criticalAlertCount} critical
                  </p>
                )}
              </div>
            </div>

            {/* Dashboard body */}
            <div className='doc-grid'>
              {/* Today's schedule */}
              <div className='doc-card doc-schedule-card'>
                <div className='doc-card-header'>
                  <h3 className='doc-card-title'>Today's Schedule</h3>
                  <span className='doc-date-badge'>{badgeDateFormat}</span>
                </div>

                {visitOverviewLoading && (
                  <p className='visit-overview-empty'>
                    Loading visit overview...
                  </p>
                )}

                {visitOverviewError && (
                  <p className='visit-overview-empty'>{visitOverviewError}</p>
                )}

                {visitOverviewItems.map((appt, index) => (
                  <div
                    key={appt.id || appt.name}
                    className={`doc-sched-row${index === 0 ? " now" : ""} clickable`}
                    onClick={() => openVisitOverview(appt.id)}>
                    <span className='doc-sched-time'>{appt.time || "TBD"}</span>
                    <span className='doc-sched-dot'></span>

                    <div className='doc-sched-info'>
                      <p className='doc-sched-name'>{appt.name}</p>
                      <p className='doc-sched-type'>{appt.type}</p>
                    </div>

                    {index === 0 && <span className='doc-now-badge'>Now</span>}
                  </div>
                ))}
              </div>

              {/* Middle section for AI summaries and notes */}
              <div className='doc-col-main'>
                <div className='doc-card'>
                  <div className='doc-card-header'>
                    <div>
                      <h3 className='doc-card-title'>AI Pre-Visit Summaries</h3>
                      <p className='doc-card-subtitle'>
                        Generated from records, labs, and prior notes
                      </p>
                    </div>

                    <span className='doc-date-badge'>
                      {Math.min(visitOverviewItems.length, 4)} upcoming
                    </span>
                  </div>

                  {visitOverviewItems.slice(0, 4).map((summary) => (
                    <div
                      key={summary.id}
                      className='doc-summary-item clickable'
                      onClick={() => openVisitOverview(summary.id)}>
                      <div className='doc-summary-top'>
                        <div className='doc-summary-avatar'>
                          {summary.initials || "PT"}
                        </div>

                        <div className='doc-summary-info'>
                          <p className='doc-summary-name'>{summary.name}</p>
                          <p className='doc-summary-appt'>
                            {summary.time || "TBD"} ·{" "}
                            {summary.type || "Visit Overview"}
                          </p>
                        </div>

                        <div className='doc-summary-tags'>
                          <span className='doc-tag doc-tag-info'>
                            Visit overview
                          </span>
                        </div>
                      </div>

                      <p className='doc-summary-snippet'>
                        Open the patient visit overview generated from available
                        appointment, patient, and lab records.
                      </p>
                    </div>
                  ))}
                </div>

                <div className='doc-card'>
                  <div className='doc-card-header'>
                    <div>
                      <h3 className='doc-card-title'>Unsigned Encounters</h3>
                      <p className='doc-card-subtitle'>
                        Notes pending your signature
                      </p>
                    </div>

                    <span className='doc-date-badge'>
                      {unsignEnCount} pending
                    </span>
                  </div>

                  {unsignEn.map((encounter) => (
                    <div key={encounter.name} className='doc-encounter-row'>
                      <div className='doc-encounter-info'>
                        <p className='doc-encounter-name'>
                          {encounter.name}

                          {encounter.urgent && (
                            <span className='doc-urgent-badge'>Urgent</span>
                          )}
                        </p>

                        <p className='doc-encounter-detail'>
                          {encounter.detail}
                        </p>
                      </div>

                      <div className='doc-encounter-actions'>
                        <button className='doc-btn-review'>Review</button>
                        <button className='doc-btn-sign'>Sign</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Patient alerts */}
              <div className='doc-card doc-alerts-card'>
                <div className='doc-card-header'>
                  <h3 className='doc-card-title'>Patient Alerts</h3>
                  <span className='doc-date-badge'>
                    {activeAlertCount} active
                  </span>
                </div>

                {patientAlerts.map((alert) => (
                  <div key={alert.name} className='doc-alert-row'>
                    <div className='doc-alert-icon'>!</div>

                    <div>
                      <p className='doc-alert-name'>{alert.name}</p>
                      <p className='doc-alert-desc'>{alert.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className='doc-footer'>
        <div className='doc-footer-left'>
          <span className='dash-logo'>
            <u>HealthNest</u>
          </span>

          <p className='doc-footer-tag'>
            Coordinated care across clinics,
            <br />
            built for patients and providers.
          </p>
        </div>

        <div className='doc-footer-links'>
          <div>
            <p className='doc-footer-heading'>PLATFORM</p>

            {[
              "Patient Portal",
              "Provider Tools",
              "AI Health Assistant",
              "Appointment Scheduling",
            ].map((link) => (
              <p key={link} className='doc-footer-link'>
                {link}
              </p>
            ))}
          </div>

          <div>
            <p className='doc-footer-heading'>SUPPORT</p>

            {[
              "Help Center",
              "Contact Us",
              "Privacy Policy",
              "Terms of Service",
            ].map((link) => (
              <p key={link} className='doc-footer-link'>
                {link}
              </p>
            ))}
          </div>
        </div>
      </footer>

      <div className='doc-copyright'>
        © 2026 HealthNest Technologies, Inc. All rights reserved.
      </div>

      {selectedVisit && (
        <VisitOverviewDrawer
          visit={selectedVisit}
          onClose={() => setSelectedVisit(null)}
          onOpenFullChart={openFullChart}
        />
      )}

      {/* ── Floating AI button ── */}
      <button className='doc-pulse-fab' aria-label='Pulse AI'>
        <MessageCircleQuestion size={25} />
      </button>
    </div>
  );
}
