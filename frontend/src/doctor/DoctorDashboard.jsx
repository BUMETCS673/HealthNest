/**
 * AI-USAGE SUMMARY
 * Tools: Opus 4.7
 * Overall AI Contribution: ~70%
 * AI-Assisted Areas: Generated the editable entries grid, the per-field meta inputs, the per-entry diff calculation that builds the minimal patch payload, the sticky action footer, the eyebrow + MRN-pill header, and the summary stat tiles.
 * Human Contributions: Workflow design (save vs release-with-implicit-patch), the manual-entry-required gating on release, the patient-name resolution wiring, and the decision to mirror server state into a local editable copy with explicit diffing rather than a controlled-from-server pattern.
 */

import { useEffect, useState, useRef } from "react";
import "./DoctorDashboard.css";
import {
  Search,
  FileSignature,
  MessageSquare,
  Users,
  FileText,
  AlertCircle,
  MessageCircleQuestion,
  FlaskConical,
} from "lucide-react";
import LabResultsPage from "../labresults/LabResultsPage";
import LabResultReview from "../labresults/LabResultReview";
import { authApi } from "../lib/authApi";
import { useMessages } from "../messages/MessagesProvider";
import MessagesView from "../messages/MessagesView";
import ProviderSchedule from "./ProviderSchedule";
import TodayScheduleCard from "./TodayScheduleCard";
import { useDfa } from "../pulse/DfaProvider";
import TopNav from "../components/TopNav";
import Footer from "../components/Footer";

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

function AccountSettings({ user, currentUser, onBack }) {
  const [editingName, setEditingName] = useState(false);
  const [displayName, setDisplayName] = useState(currentUser.fullName);
  const [nameValue, setNameValue] = useState(currentUser.fullName);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMsg, setNameMsg] = useState("");

  const [editingSpecialty, setEditingSpecialty] = useState(false);
  const [displaySpecialty, setDisplaySpecialty] = useState(
    currentUser.specialty || "",
  );
  const [specialtyValue, setSpecialtyValue] = useState(
    currentUser.specialty || "",
  );
  const [specialtySaving, setSpecialtySaving] = useState(false);
  const [specialtyMsg, setSpecialtyMsg] = useState("");

  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState("");

  const [authBusy, setAuthBusy] = useState(false);
  const [authMsg, setAuthMsg] = useState("");

  const handleSaveName = async () => {
    if (!nameValue.trim()) return;
    setNameSaving(true);
    setNameMsg("");
    try {
      const parts = nameValue.trim().split(" ");
      const first = parts[0] || "";
      const last = parts.slice(1).join(" ") || "";
      await authApi.updateProfile({ first_name: first, last_name: last });
      setDisplayName(nameValue.trim());
      setNameMsg("Name updated.");
      setEditingName(false);
    } catch (e) {
      setNameMsg("Could not update name: " + (e.message || e));
    } finally {
      setNameSaving(false);
    }
  };

  const handleSaveSpecialty = async () => {
    setSpecialtySaving(true);
    setSpecialtyMsg("");
    try {
      const parts = displayName.trim().split(" ");
      await authApi.updateProfile({
        first_name: parts[0] || "",
        last_name: parts.slice(1).join(" ") || "",
        specialty: specialtyValue.trim(),
      });
      setDisplaySpecialty(specialtyValue.trim());
      setSpecialtyMsg("Specialty updated.");
      setEditingSpecialty(false);
    } catch (e) {
      setSpecialtyMsg("Could not update specialty: " + (e.message || e));
    } finally {
      setSpecialtySaving(false);
    }
  };

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
    <section className="acct-page">
      <div className="acct-header">
        <h3 className="acct-title">Account Settings</h3>
        <button className="dash-view-all" onClick={onBack}>
          Back to dashboard
        </button>
      </div>

      <div className="acct-section">
        <p className="acct-section-label">Profile</p>

        <div className="acct-row">
          <span className="acct-row-key">Name</span>
          {editingName ? (
            <div className="acct-inline-edit">
              <input
                className="acct-input"
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                autoFocus
              />
              <div className="acct-inline-actions">
                <button
                  className="acct-btn-primary"
                  onClick={handleSaveName}
                  disabled={nameSaving}
                >
                  {nameSaving ? "Saving…" : "Save"}
                </button>
                <button
                  className="acct-btn-ghost"
                  onClick={() => {
                    setEditingName(false);
                    setNameValue(displayName);
                    setNameMsg("");
                  }}
                >
                  Cancel
                </button>
              </div>
              {nameMsg && <p className="acct-msg">{nameMsg}</p>}
            </div>
          ) : (
            <div className="acct-row-value-wrap">
              <span className="acct-row-value">{displayName}</span>
              <button
                className="acct-edit-link"
                onClick={() => setEditingName(true)}
              >
                Edit
              </button>
            </div>
          )}
        </div>

        <div className="acct-row">
          <span className="acct-row-key">Role</span>
          <span className="acct-row-value">{currentUser.role}</span>
        </div>

        <div className="acct-row">
          <span className="acct-row-key">Specialty</span>
          {editingSpecialty ? (
            <div className="acct-inline-edit">
              <input
                className="acct-input"
                value={specialtyValue}
                onChange={(e) => setSpecialtyValue(e.target.value)}
                autoFocus
              />
              <div className="acct-inline-actions">
                <button
                  className="acct-btn-primary"
                  onClick={handleSaveSpecialty}
                  disabled={specialtySaving}
                >
                  {specialtySaving ? "Saving…" : "Save"}
                </button>
                <button
                  className="acct-btn-ghost"
                  onClick={() => {
                    setEditingSpecialty(false);
                    setSpecialtyValue(displaySpecialty);
                    setSpecialtyMsg("");
                  }}
                >
                  Cancel
                </button>
              </div>
              {specialtyMsg && <p className="acct-msg">{specialtyMsg}</p>}
            </div>
          ) : (
            <div className="acct-row-value-wrap">
              <span className="acct-row-value">
                {displaySpecialty || "Not set"}
              </span>
              <button
                className="acct-edit-link"
                onClick={() => setEditingSpecialty(true)}
              >
                Edit
              </button>
            </div>
          )}
        </div>

        <div className="acct-row">
          <span className="acct-row-key">Email</span>
          <span className="acct-row-value">
            {user?.email || "Not available"}
          </span>
        </div>
      </div>

      <div className="acct-section">
        <p className="acct-section-label">Password</p>
        {!pwOpen ? (
          <button
            className="acct-btn-outline"
            onClick={() => {
              setPwOpen(true);
              setPwMsg("");
            }}
          >
            Change password
          </button>
        ) : (
          <div className="acct-pw-form">
            <div className="acct-field">
              <label className="acct-field-label">Current password</label>
              <input
                className="acct-input"
                type="password"
                value={pw.current}
                onChange={(e) =>
                  setPw((p) => ({ ...p, current: e.target.value }))
                }
              />
            </div>
            <div className="acct-field">
              <label className="acct-field-label">New password</label>
              <input
                className="acct-input"
                type="password"
                value={pw.next}
                onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
              />
            </div>
            <div className="acct-field">
              <label className="acct-field-label">Confirm new password</label>
              <input
                className="acct-input"
                type="password"
                value={pw.confirm}
                onChange={(e) =>
                  setPw((p) => ({ ...p, confirm: e.target.value }))
                }
              />
            </div>
            {pwMsg && <p className="acct-msg">{pwMsg}</p>}
            <div className="acct-inline-actions">
              <button
                className="acct-btn-primary"
                onClick={handleChangePassword}
                disabled={pwSaving}
              >
                {pwSaving ? "Updating…" : "Update password"}
              </button>
              <button
                className="acct-btn-ghost"
                onClick={() => {
                  setPwOpen(false);
                  setPw({ current: "", next: "", confirm: "" });
                  setPwMsg("");
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="acct-section">
        <p className="acct-section-label">Authentication</p>
        <p className="acct-section-desc">
          Enable biometric/passkey login for faster sign-in on supported
          devices.
        </p>
        <button
          className="acct-btn-primary"
          onClick={handleEnableBiometric}
          disabled={authBusy}
        >
          {authBusy ? "Setting up…" : "Enable biometric login"}
        </button>
        {authMsg && <p className="acct-msg">{authMsg}</p>}
      </div>
    </section>
  );
}

// Temp data until backend data connect

const patientAlerts = [];

function VisitOverviewDrawer({
  visit,
  onClose,
  onOpenFullChart,
  onSaveEncounterDraft,
  onSignEncounterNote,
}) {
  const patient = visit.patient || {};
  const appointment = visit.appointment || {};

  const [encounterNote, setEncounterNote] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteMessage, setNoteMessage] = useState("");
  const recentHistory = visit.recentHistory || [];
  const activeProblems = visit.activeProblems || [];
  const medications = visit.medications || [];
  const labs = visit.labs || [];
  const openIssues = visit.openIssues || [];
  const missingSections = visit.missingSections || [];

  const handleSaveDraft = async () => {
    if (!encounterNote.trim()) {
      setNoteMessage("Please enter a note before saving.");
      return;
    }

    setNoteSaving(true);
    setNoteMessage("");

    try {
      await onSaveEncounterDraft(visit, encounterNote);
      setNoteMessage("Draft saved to Unsigned Encounters.");
      setEncounterNote("");
    } catch (error) {
      setNoteMessage(error.message || "Unable to save draft.");
    } finally {
      setNoteSaving(false);
    }
  };

  const handleSignNote = async () => {
    if (!encounterNote.trim()) {
      setNoteMessage("Please enter a note before signing.");
      return;
    }

    setNoteSaving(true);
    setNoteMessage("");

    try {
      await onSignEncounterNote(visit, encounterNote);
      setNoteMessage("Encounter note signed.");
      setEncounterNote("");
    } catch (error) {
      setNoteMessage(error.message || "Unable to sign note.");
    } finally {
      setNoteSaving(false);
    }
  };

  return (
    <div className="visit-overview-backdrop">
      <aside className="visit-overview-drawer" aria-label="Visit overview">
        <div className="visit-overview-header">
          <div className="visit-overview-patient-header">
            <div className="visit-overview-avatar">{patient.initials}</div>

            <div>
              <div className="visit-overview-name-line">
                <h2>{patient.name}</h2>
                <span>{patient.mrn}</span>
                <span>DOB {patient.dateOfBirth}</span>
              </div>

              <p className="visit-overview-meta">
                {appointment.time || "TBD"} · {appointment.visitType}
              </p>
            </div>
          </div>

          <button
            type="button"
            className="visit-overview-close"
            onClick={onClose}
            aria-label="Close visit overview"
          >
            ×
          </button>
        </div>

        <section className="visit-overview-section">
          <h3>Recent History</h3>

          <div className="visit-history-list">
            {recentHistory.map((item) => (
              <div key={item.date + item.title} className="visit-history-card">
                <div className="visit-history-date">
                  <p>{item.date}</p>
                  <span>{item.provider}</span>
                </div>

                <div className="visit-history-detail">
                  <p>{item.title}</p>
                  <span>{item.detail}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="visit-overview-section">
          <h3>Active Problems</h3>

          <div className="visit-problem-list">
            {activeProblems.map((problem) => (
              <div key={problem.name} className="visit-problem-row">
                <div className="visit-problem-left">
                  <span className="visit-problem-dot"></span>

                  <div>
                    <p>{problem.name}</p>
                    <span>
                      {problem.code} · Since {problem.since}
                    </span>
                  </div>
                </div>

                <span className="visit-problem-status">{problem.status}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="visit-overview-section">
          <h3>Medications</h3>

          <div className="visit-table-wrap">
            <table className="visit-overview-table">
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
                      {med.flagged && <span className="visit-med-flag">!</span>}
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

        <section className="visit-overview-section">
          <h3>Last Labs</h3>

          <div className="visit-table-wrap">
            <table className="visit-overview-table">
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

        <section className="visit-overview-section">
          <h3>Open Issues</h3>

          <div className="visit-issues-list">
            {openIssues.map((issue) => (
              <div key={issue.text} className="visit-issue-card">
                <span className={`visit-issue-badge visit-issue-${issue.tone}`}>
                  {issue.level}
                </span>

                <span className="visit-issue-text">{issue.text}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="visit-overview-section">
          <h3>Encounter Note</h3>
          <p className="visit-overview-meta">
            Draft a note for this visit. Saved drafts appear in Unsigned
            Encounters.
          </p>

          <textarea
            className="visit-note-textarea"
            placeholder="Write encounter note..."
            value={encounterNote}
            onChange={(e) => setEncounterNote(e.target.value)}
          />

          <div className="visit-note-actions">
            <button
              type="button"
              className="doc-btn-review"
              onClick={handleSaveDraft}
              disabled={noteSaving}
            >
              {noteSaving ? "Saving..." : "Save Draft"}
            </button>

            <button
              type="button"
              className="doc-btn-sign"
              onClick={handleSignNote}
              disabled={noteSaving}
            >
              {noteSaving ? "Signing..." : "Sign Note"}
            </button>
            {noteMessage && <p className="acct-msg">{noteMessage}</p>}
          </div>
        </section>

        {missingSections.length > 0 && (
          <section className="visit-overview-section">
            <h3>Missing Information</h3>

            <ul className="visit-overview-list visit-overview-warning-list">
              {missingSections.map((section) => (
                <li key={section}>{section}</li>
              ))}
            </ul>
          </section>
        )}

        <div className="visit-overview-actions">
          <p className="visit-overview-source">{visit.generatedFrom}</p>

          <div className="visit-overview-action-buttons">
            <button
              type="button"
              className="doc-btn-sign"
              onClick={() => onOpenFullChart(visit)}
            >
              Open Full Chart
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

export default function DoctorDashboard({
  user,
  onSignOut,
  onNavigate,
  initialView = "home",
}) {
  const currentUser = getCurrUser(user);
  const dfa = useDfa();
  const { unreadCount: unreadMessages, openThread, openDrawer } = useMessages();

  const [view, setView] = useState(initialView);

  // Keep the visible view in sync with the URL-derived initialView (browser
  // back/forward, returning from the Pulse workspace). Adjusting state during
  // render is React's recommended alternative to a syncing effect here.
  const [syncedView, setSyncedView] = useState(initialView);
  if (initialView !== syncedView) {
    setSyncedView(initialView);
    setView(initialView);
  }

  // Opening a patient's message thread from the schedule (Message action):
  // open the global messaging drawer to that conversation instead of leaving
  // the current page for the full Messages view.
  const messagePatient = (appt) => {
    const contactId = appt?.patient_user_id;
    if (!contactId) return;
    openThread(contactId);
    openDrawer();
  };

  const [activeLabId, setActiveLabId] = useState(null);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [selectedChart, setSelectedChart] = useState(null);
  const [chartTab, setChartTab] = useState("overview");
  const [visitOverviewItems, setVisitOverviewItems] = useState([]);
  const [visitOverviewError, setVisitOverviewError] = useState("");
  const [visitOverviewLoading, setVisitOverviewLoading] = useState(false);
  const [unsignedEncounters, setUnsignedEncounters] = useState([]);
  const [unsignedEncounterError, setUnsignedEncounterError] = useState("");
  const [unsignedEncounterLoading, setUnsignedEncounterLoading] =
    useState(false);
  const [signingEncounterId, setSigningEncounterId] = useState(null);
  const [selectedUnsignedEncounter, setSelectedUnsignedEncounter] =
    useState(null);

  const getAuthHeaders = () => {
    const session = authApi.getSession();

    if (!session?.access_token) {
      return {};
    }

    return {
      Authorization: `Bearer ${session.access_token}`,
    };
  };

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

  const loadUnsignedEncounters = async () => {
    setUnsignedEncounterLoading(true);
    setUnsignedEncounterError("");

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/providers/unsigned-encounters`,
        {
          headers: getAuthHeaders(),
        },
      );

      if (!response.ok) {
        throw new Error("Unable to load unsigned encounters.");
      }

      const data = await response.json();
      setUnsignedEncounters(data);
    } catch (error) {
      setUnsignedEncounterError(
        error.message || "Unable to load unsigned encounters.",
      );
    } finally {
      setUnsignedEncounterLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadUnsignedEncounters();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const handleSignEncounter = async (encounterId) => {
    setSigningEncounterId(encounterId);
    setUnsignedEncounterError("");

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/providers/unsigned-encounters/${encounterId}/sign`,
        {
          method: "PATCH",
          headers: getAuthHeaders(),
        },
      );

      if (!response.ok) {
        throw new Error("Unable to sign encounter.");
      }

      setUnsignedEncounters((current) =>
        current.filter((encounter) => encounter.id !== encounterId),
      );
    } catch (error) {
      setUnsignedEncounterError(error.message || "Unable to sign encounter.");
    } finally {
      setSigningEncounterId(null);
    }
  };

  const saveEncounterNote = async (visit, noteText, shouldSign = false) => {
    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/providers/encounter-notes`,
      {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          patientId: visit.patient?.id,
          encounterType: visit.appointment?.visitType || "Visit Note",
          summary: noteText,
          signed: shouldSign,
        }),
      },
    );

    if (!response.ok) {
      throw new Error("Unable to save encounter note.");
    }

    await loadUnsignedEncounters();

    return response.json();
  };

  const handleSaveEncounterDraft = async (visit, noteText) => {
    return saveEncounterNote(visit, noteText, false);
  };

  const handleSignEncounterNote = async (visit, noteText) => {
    return saveEncounterNote(visit, noteText, true);
  };

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
  const unsignedEncountersRef = useRef(null);
  const signNotesCount = unsignedEncounters.length;
  const inboxCount = 0;

  const todayPatientsCount = visitOverviewItems.length;

  const seenPatientCount = 0;

  const pendingPatientCount = visitOverviewItems.length;

  const unsignEnCount = unsignedEncounters.length;

  const urgentEncounterCount = unsignedEncounters.filter((encounter) => {
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
    <div className="d-dash">
      {/* Navigation bar */}
      <TopNav
        links={navOption.map((o) =>
          o === "Messages" ? { label: o, badge: unreadMessages } : o,
        )}
        activeKey={
          view === "home"
            ? "Dashboard"
            : view === "labs" || view === "lab-review" || view === "full-chart"
              ? "Patient Records"
              : view === "messages"
                ? "Messages"
                : view === "schedule"
                  ? "Schedule"
                  : null
        }
        onLogoClick={() => {
          setView("home");
          onNavigate?.("dashboard");
        }}
        onSelect={(label) => {
          // Set the view immediately (resets any drill-down) and update the URL.
          if (label === "Dashboard") {
            setView("home");
            onNavigate?.("dashboard");
          } else if (label === "Patient Records") {
            setView("labs");
            onNavigate?.("patient-records");
          } else if (label === "Messages") {
            setView("messages");
            onNavigate?.("messages");
          } else if (label === "Schedule") {
            setView("schedule");
            onNavigate?.("schedule");
          } else if (label === "Pulse AI") {
            onNavigate?.("dfa-pulse");
          }
        }}
        userName={currentUser.firstName}
        userRole={currentUser.specialty || currentUser.role}
        userInitials={currentUser.initials}
        onAccountSettings={() => setView("account-settings")}
        onSignOut={onSignOut}
      />

      {/* Main content */}
      <main
        className={`doc-main${view === "messages" ? " doc-main--messages" : ""}`}
      >
        {view === "labs" && (
          <LabResultsPage
            onBack={() => setView("home")}
            onOpenReview={(id) => {
              setActiveLabId(id);
              setView("lab-review");
            }}
          />
        )}

        {view === "messages" && <MessagesView myId={user?.id} />}
        {view === "account-settings" && (
          <AccountSettings
            user={user}
            currentUser={currentUser}
            onBack={() => setView("home")}
          />
        )}

        {view === "full-chart" && selectedChart && (
          <div className="patient-record-page">
            <button
              type="button"
              className="patient-record-back"
              onClick={() => {
                setSelectedChart(null);
                setView("home");
              }}
            >
              ← All Patients
            </button>

            <section className="patient-record-hero">
              <div className="patient-record-left">
                <div className="patient-record-avatar">
                  {selectedChart.patient?.initials || "PT"}
                </div>

                <div>
                  <div className="patient-record-name-row">
                    <h1>{selectedChart.patient?.name || "Unknown Patient"}</h1>
                    <span>
                      MRN {selectedChart.patient?.mrn || "Unavailable"}
                    </span>
                  </div>

                  <p className="patient-record-meta">
                    DOB {selectedChart.patient?.dateOfBirth || "Unavailable"} ·
                    Last visit{" "}
                    {selectedChart.appointment?.date || "Unavailable"}
                  </p>

                  <p className="patient-record-summary">
                    {selectedChart.appointment?.visitType || "Visit Overview"} ·{" "}
                    {selectedChart.appointment?.status || "Status unavailable"}
                  </p>
                </div>
              </div>

              <div className="patient-record-actions">
                <button type="button" className="patient-record-secondary">
                  Message
                </button>
              </div>
            </section>

            <div className="patient-record-tabs">
              <button
                type="button"
                className={`patient-record-tab ${
                  chartTab === "overview" ? "active" : ""
                }`}
                onClick={() => setChartTab("overview")}
              >
                Overview
              </button>

              <button
                type="button"
                className={`patient-record-tab ${
                  chartTab === "documents" ? "active" : ""
                }`}
                onClick={() => setChartTab("documents")}
              >
                Documents
              </button>

              <button
                type="button"
                className={`patient-record-tab ${
                  chartTab === "labs" ? "active" : ""
                }`}
                onClick={() => setChartTab("labs")}
              >
                Labs
              </button>

              <button
                type="button"
                className={`patient-record-tab ${
                  chartTab === "medications" ? "active" : ""
                }`}
                onClick={() => setChartTab("medications")}
              >
                Medications
              </button>
            </div>

            {chartTab === "overview" && (
              <>
                <div className="patient-record-grid">
                  <section className="patient-record-card">
                    <h2>Active Problems</h2>

                    {(selectedChart.activeProblems || []).length === 0 ? (
                      <p className="patient-record-empty">
                        Active problem list unavailable.
                      </p>
                    ) : (
                      selectedChart.activeProblems.map((problem) => (
                        <div key={problem.name} className="patient-problem-row">
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

                  <section className="patient-record-card">
                    <h2>Open Issues</h2>

                    {(selectedChart.openIssues || []).filter((issue) => {
                      return !issue.text
                        ?.toLowerCase()
                        .includes("no recent lab results");
                    }).length === 0 ? (
                      <p className="patient-record-empty">
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
                          <div key={issue.text} className="patient-issue-row">
                            <span
                              className={`patient-issue-badge ${issue.tone || ""}`}
                            >
                              {issue.level || "Info"}
                            </span>

                            <p>{issue.text}</p>
                          </div>
                        ))
                    )}
                  </section>
                </div>

                <section className="patient-record-card patient-record-history">
                  <h2>Visit History</h2>

                  {(selectedChart.recentHistory || []).length === 0 ? (
                    <p className="patient-record-empty">
                      No visit history available.
                    </p>
                  ) : (
                    selectedChart.recentHistory.map((item) => (
                      <div
                        key={item.date + item.title}
                        className="patient-history-row"
                      >
                        <div className="patient-history-date">
                          <p>{item.date || "No date"}</p>
                          <span>{item.provider || "Provider unavailable"}</span>
                        </div>

                        <div className="patient-history-main">
                          <span>{item.title || "Visit"}</span>
                          <p>{item.detail || "No detail available."}</p>
                        </div>
                      </div>
                    ))
                  )}
                </section>

                <section className="patient-record-card patient-record-history">
                  <h2>Missing Information</h2>

                  {(selectedChart.missingSections || []).length === 0 ? (
                    <p className="patient-record-empty">
                      No missing information flagged.
                    </p>
                  ) : (
                    <ul className="patient-missing-list">
                      {selectedChart.missingSections.map((section) => (
                        <li key={section}>{section}</li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            )}

            {chartTab === "documents" && (
              <section className="patient-record-card patient-record-history">
                <h2>Documents</h2>
                <p className="patient-record-empty">No documents available.</p>
              </section>
            )}

            {chartTab === "labs" && (
              <section className="patient-record-card patient-record-history">
                <h2>Lab Results</h2>

                {(selectedChart.labs || []).length === 0 ? (
                  <p className="patient-record-empty">
                    No lab information available.
                  </p>
                ) : (
                  <table className="patient-record-table">
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
              <section className="patient-record-card patient-record-history">
                <h2>Current Medications</h2>

                {(selectedChart.medications || []).length === 0 ? (
                  <p className="patient-record-empty">
                    Medication information unavailable.
                  </p>
                ) : (
                  <table className="patient-record-table">
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
        {view === "schedule" && (
          <ProviderSchedule onMessagePatient={messagePatient} />
        )}

        {view !== "home" ? null : (
          <>
            {/* Header */}
            <div className="doc-header">
              <div>
                <p className="doc-date">{dateFormat}</p>
                <h1 className="doc-greeting">
                  {greetingMes}, {currentUser.firstName}.
                </h1>
              </div>

              <div className="doc-header-actions">
                <div className="doc-search">
                  <Search size={14} />
                  <span>Quick patient lookup...</span> {/*search bar*/}
                </div>

                <button
                  className="doc-action-btn"
                  onClick={() => {
                    loadUnsignedEncounters();
                    unsignedEncountersRef.current?.scrollIntoView({
                      behavior: "smooth",
                    });
                  }}
                >
                  <FileSignature size={14} />
                  Sign Notes
                  {signNotesCount > 0 && (
                    <span className="doc-action-count">{signNotesCount}</span>
                  )}
                </button>

                <button
                  className="doc-action-btn"
                  onClick={() => setView("labs")}
                >
                  <FlaskConical size={14} />
                  Lab Results
                </button>

                <button
                  className="doc-action-btn doc-action-filled"
                  onClick={() => setView("messages")}
                >
                  <MessageSquare size={14} />
                  Inbox
                  {inboxCount > 0 && (
                    <span className="doc-action-count doc-action-count-light">
                      {inboxCount}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Top summary cards */}
            <div className="doc-stats">
              <div className="doc-stat-item">
                <Users size={18} className="doc-stat-icon" />

                <div className="doc-stat-main">
                  <p className="doc-stat-label">Today's Patients</p>
                  <p className="doc-stat-value">
                    {todayPatientsCount} scheduled
                  </p>
                </div>

                <p className="doc-stat-side">
                  {seenPatientCount} seen · {pendingPatientCount} pending
                </p>
              </div>

              <div className="doc-stat-item">
                <FileText size={18} className="doc-stat-icon" />

                <div className="doc-stat-main">
                  <p className="doc-stat-label">Unsigned Encounters</p>
                  <p className="doc-stat-value">{unsignEnCount} notes</p>
                </div>

                {urgentEncounterCount > 0 && (
                  <p className="doc-stat-side doc-stat-side-urgent">
                    {urgentEncounterCount} urgent
                  </p>
                )}
              </div>

              <div className="doc-stat-item">
                <AlertCircle
                  size={18}
                  className="doc-stat-icon doc-stat-alert"
                />

                <div className="doc-stat-main">
                  <p className="doc-stat-label">Clinical Alerts</p>
                  <p className="doc-stat-value">{activeAlertCount} active</p>
                </div>

                {criticalAlertCount > 0 && (
                  <p className="doc-stat-side doc-stat-side-urgent">
                    {criticalAlertCount} critical
                  </p>
                )}
              </div>
            </div>

            {/* Dashboard body */}
            <div className="doc-grid">
              {/* Today's schedule — hours-of-the-day grid (scrolled to now) */}
              <TodayScheduleCard
                onOpenSchedule={() => {
                  setView("schedule");
                  onNavigate?.("schedule");
                }}
                onMessagePatient={messagePatient}
              />

              {/* Middle section for AI summaries and notes */}
              <div className="doc-col-main">
                <div className="doc-card">
                  <div className="doc-card-header">
                    <div>
                      <h3 className="doc-card-title">AI Pre-Visit Summaries</h3>
                      <p className="doc-card-subtitle">
                        Generated from records, labs, and prior notes
                      </p>
                    </div>

                    <span className="doc-date-badge">
                      {Math.min(visitOverviewItems.length, 4)} upcoming
                    </span>
                  </div>

                  {visitOverviewItems.slice(0, 4).map((summary) => (
                    <div
                      key={summary.id}
                      className="doc-summary-item clickable"
                      onClick={() => openVisitOverview(summary.id)}
                    >
                      <div className="doc-summary-top">
                        <div className="doc-summary-avatar">
                          {summary.initials || "PT"}
                        </div>

                        <div className="doc-summary-info">
                          <p className="doc-summary-name">{summary.name}</p>
                          <p className="doc-summary-appt">
                            {summary.time || "TBD"} ·{" "}
                            {summary.type || "Visit Overview"}
                          </p>
                        </div>

                        <div className="doc-summary-tags">
                          <span className="doc-tag doc-tag-info">
                            Visit overview
                          </span>
                        </div>
                      </div>

                      <p className="doc-summary-snippet">
                        Open the patient visit overview generated from available
                        appointment, patient, and lab records.
                      </p>
                    </div>
                  ))}
                </div>

                <div className="doc-card" ref={unsignedEncountersRef}>
                  <div className="doc-card-header">
                    <div>
                      <h3 className="doc-card-title">Unsigned Encounters</h3>
                      <p className="doc-card-subtitle">
                        Notes pending your signature
                      </p>
                    </div>

                    <span className="doc-date-badge">
                      {unsignEnCount} pending
                    </span>
                  </div>

                  {unsignedEncounterLoading && (
                    <p className="visit-overview-empty">
                      Loading unsigned encounters...
                    </p>
                  )}

                  {unsignedEncounterError && (
                    <p className="visit-overview-empty">
                      {unsignedEncounterError}
                    </p>
                  )}

                  {!unsignedEncounterLoading &&
                    !unsignedEncounterError &&
                    unsignedEncounters.length === 0 && (
                      <p className="visit-overview-empty">
                        No unsigned encounters pending.
                      </p>
                    )}

                  {unsignedEncounters.map((encounter) => (
                    <div key={encounter.id} className="doc-encounter-row">
                      <div className="doc-encounter-info">
                        <p className="doc-encounter-name">
                          {encounter.name}

                          {encounter.urgent && (
                            <span className="doc-urgent-badge">Urgent</span>
                          )}
                        </p>

                        <p className="doc-encounter-detail">
                          {encounter.detail}
                        </p>
                      </div>

                      <div className="doc-encounter-actions">
                        <button
                          className="doc-btn-review"
                          onClick={() =>
                            setSelectedUnsignedEncounter(encounter)
                          }
                        >
                          Review
                        </button>
                        <button
                          className="doc-btn-sign"
                          onClick={() => handleSignEncounter(encounter.id)}
                          disabled={signingEncounterId === encounter.id}
                        >
                          {signingEncounterId === encounter.id
                            ? "Signing..."
                            : "Sign"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Patient alerts */}
              <div className="doc-card doc-alerts-card">
                <div className="doc-card-header">
                  <h3 className="doc-card-title">Patient Alerts</h3>
                  <span className="doc-date-badge">
                    {activeAlertCount} active
                  </span>
                </div>

                {patientAlerts.map((alert) => (
                  <div key={alert.name} className="doc-alert-row">
                    <div className="doc-alert-icon">!</div>

                    <div>
                      <p className="doc-alert-name">{alert.name}</p>
                      <p className="doc-alert-desc">{alert.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>

      {selectedUnsignedEncounter && (
        <div className="visit-overview-backdrop">
          <aside
            className="visit-overview-drawer"
            aria-label="Unsigned encounter review"
          >
            <div className="visit-overview-header">
              <div>
                <h2>{selectedUnsignedEncounter.name}</h2>
                <p className="visit-overview-meta">
                  {selectedUnsignedEncounter.detail}
                </p>
              </div>

              <button
                type="button"
                className="visit-overview-close"
                onClick={() => setSelectedUnsignedEncounter(null)}
                aria-label="Close unsigned encounter review"
              >
                ×
              </button>
            </div>

            <section className="visit-overview-section">
              <h3>Encounter Summary</h3>
              <p>
                {selectedUnsignedEncounter.summary ||
                  "No summary available for this encounter."}
              </p>
            </section>

            <div className="visit-overview-actions">
              <p className="visit-overview-source">
                Unsigned encounter pending provider signature
              </p>

              <div className="visit-overview-action-buttons">
                <button
                  type="button"
                  className="doc-btn-review"
                  onClick={() => setSelectedUnsignedEncounter(null)}
                >
                  Close
                </button>

                <button
                  type="button"
                  className="doc-btn-sign"
                  onClick={() => {
                    handleSignEncounter(selectedUnsignedEncounter.id);
                    setSelectedUnsignedEncounter(null);
                  }}
                >
                  Sign
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {selectedVisit && (
        <VisitOverviewDrawer
          visit={selectedVisit}
          onClose={() => setSelectedVisit(null)}
          onOpenFullChart={openFullChart}
          onSaveEncounterDraft={handleSaveEncounterDraft}
          onSignEncounterNote={handleSignEncounterNote}
        />
      )}

      {/* ── Floating AI button ── */}
      <button
        className="doc-pulse-fab"
        aria-label="Pulse AI"
        onClick={() => dfa.openDrawer()}
      >
        <MessageCircleQuestion size={25} />
      </button>
      <Footer
        role="provider"
        onNavigate={(target) => {
          if (target === "dashboard") setView("home");
          else if (target === "schedule") setView("schedule");
          else if (target === "patient-records") setView("labs");
          else if (target === "messages") setView("messages");
          else onNavigate?.(target);
        }}
      />
    </div>
  );
}
