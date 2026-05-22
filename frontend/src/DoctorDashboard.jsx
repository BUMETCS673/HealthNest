import { useEffect, useRef, useState } from "react";
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
} from "lucide-react";

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
const todaySchedule = [
  {
    time: "8:00 AM",
    name: "Robert Kim",
    type: "Initial Consult",
    done: true,
  },
  {
    time: "8:30 AM",
    name: "Maria Santos",
    type: "Follow-up",
    done: true,
  },
  {
    time: "9:00 AM",
    name: "David Williams",
    type: "ECG Review",
    done: true,
  },
  {
    time: "9:30 AM",
    name: "Jennifer Lee",
    type: "Medication Review",
    now: true,
  },
  {
    time: "10:30 AM",
    name: "Thomas Brown",
    type: "Annual Checkup",
  },
  {
    time: "11:00 AM",
    name: "Amanda Clark",
    type: "Stress Test Review",
  },
  {
    time: "11:30 AM",
    name: "James Martinez",
    type: "New Patient",
  },
];

const aiSummaries = [
  {
    id: 1,
    initials: "JL",
    name: "Jennifer Lee",
    time: "9:30 AM",
    apptType: "Medication Review",
    tags: [{ label: "Drug interaction", style: "warning" }],
    snippet:
      "Patient on Warfarin for AFib. Recent aspirin added by external provider — potential interaction flagged. Last INR...",
  },
  {
    id: 2,
    initials: "TB",
    name: "Thomas Brown",
    time: "10:30 AM",
    apptType: "Annual Checkup",
    tags: [{ label: "Holter pending", style: "caution" }],
    snippet:
      "53-year-old with hypertrophic cardiomyopathy. Holter monitor results pending review. Last echo Jan 2026...",
  },
  {
    id: 3,
    initials: "AC",
    name: "Amanda Clark",
    time: "11:00 AM",
    apptType: "Stress Test Review",
    tags: [{ label: "Borderline stress test", style: "caution" }],
    snippet:
      "Stress test completed May 10. Results show mild ST depression at peak — borderline positive. Patient reports...",
  },
  {
    id: 4,
    initials: "PW",
    name: "Patricia Wang",
    time: "1:00 PM",
    apptType: "Checkup",
    tags: [
      { label: "Lab pending", style: "info" },
      { label: "Weight gain", style: "caution" },
    ],
    snippet:
      "Heart failure patient on diuretics. CBC ordered 3 days ago — results pending. Last BNP elevated at 480...",
  },
];

const patientAlerts = [
  {
    name: "Robert Kim",
    desc: "Blood pressure 158/94 — flagged high",
  },
  {
    name: "Jennifer Lee",
    desc: "Potential interaction: Warfarin + Aspirin",
  },
  {
    name: "Patricia Wang",
    desc: "Lab results pending review — CBC ordered 3 days ago",
  },
];

const unsignEn = [
  {
    name: "Robert Kim",
    detail: "Initial Consult · May 14",
    urgent: true,
  },
  {
    name: "Maria Santos",
    detail: "Follow-up Note · May 14",
    urgent: false,
  },
  {
    name: "David Williams",
    detail: "ECG Review Summary · May 13",
    urgent: false,
  },
];

export default function DoctorDashboard({ user, onSignOut }) {
  const currentUser = getCurrUser(user);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

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

  const todayPatientsCount = todaySchedule.length;

  const seenPatientCount = todaySchedule.filter((appt) => {
    return appt.done;
  }).length;

  const pendingPatientCount = todaySchedule.filter((appt) => {
    return !appt.done;
  }).length;

  const unsignEnCount = unsignEn.length;

  const urgentEncounterCount = unsignEn.filter((encounter) => {
    return encounter.urgent;
  }).length;

  const activeAlertCount = patientAlerts.length;
  const criticalAlertCount = 2;

  const navOption = [
    "Dashboard",
    "Schedule",
    "Patient Records",
    "Messages",
    "Pulse AI",
  ];

  return (
    <div className='d-dash'>
      {/* Navigation bar */}
      <nav className='dash-nav'>
        <div className='dash-nav-left'>
          <span className='dash-logo'>
            <u>HealthNest</u>
          </span>

          {navOption.map((option) => {
            const buttonClass =
              option === "Dashboard" ? "doc-nav-link active" : "doc-nav-link";

            const showMessageBadge =
              option === "Messages" && unreadMessages > 0;

            return (
              <button key={option} className={buttonClass}>
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
                    onSignOut?.();
                  }}
                  role='menuitem'>
                  <LogOut size={14} />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className='doc-main'>
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
              <p className='doc-stat-value'>{todayPatientsCount} scheduled</p>
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
            <AlertCircle size={18} className='doc-stat-icon doc-stat-alert' />

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

            {todaySchedule.map((appt) => (
              <div
                key={appt.time + appt.name}
                className={`doc-sched-row${appt.now ? " now" : ""}${
                  appt.done ? " done" : ""
                }`}>
                <span className='doc-sched-time'>{appt.time}</span>
                <span className='doc-sched-dot'></span>

                <div className='doc-sched-info'>
                  <p className='doc-sched-name'>{appt.name}</p>
                  <p className='doc-sched-type'>{appt.type}</p>
                </div>

                {appt.now && <span className='doc-now-badge'>Now</span>}
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

                <span className='doc-date-badge'>4 upcoming</span>
              </div>

              {aiSummaries.map((summary) => (
                <div key={summary.id} className='doc-summary-item'>
                  <div className='doc-summary-top'>
                    <div className='doc-summary-avatar'>{summary.initials}</div>

                    <div className='doc-summary-info'>
                      <p className='doc-summary-name'>{summary.name}</p>
                      <p className='doc-summary-appt'>
                        {summary.time} · {summary.apptType}
                      </p>
                    </div>

                    <div className='doc-summary-tags'>
                      {summary.tags.map((tag) => (
                        <span
                          key={tag.label}
                          className={`doc-tag doc-tag-${tag.style}`}>
                          {tag.label}
                        </span>
                      ))}
                    </div>
                  </div>

                  <p className='doc-summary-snippet'>{summary.snippet}</p>
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

                <span className='doc-date-badge'>{unsignEnCount} pending</span>
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

                    <p className='doc-encounter-detail'>{encounter.detail}</p>
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
              <span className='doc-date-badge'>{activeAlertCount} active</span>
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

      {/* ── Floating AI button ── */}
      <button className='doc-pulse-fab' aria-label='Pulse AI'>
        <MessageCircleQuestion size={25} />
      </button>
    </div>
  );
}
