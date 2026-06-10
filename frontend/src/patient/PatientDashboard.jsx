// AI-USAGE SUMMARY
// Tools: Claude Code, Opus 4.7
// Overall AI Contribution: ~55%
// AI-Assisted Areas: Original dashboard layout and summary cards (Claude Code); Opus 4.7 wired the Pulse AI entry points (top-nav button, banner CTA, floating FAB) into the new PulseProvider hooks.
// Human Contributions: Owned the data-source decisions (appointments + labs), the role-based gating, and the decision to wire ALL three Pulse entry points to the same drawer state so promotion to the full workspace is one click anywhere on the page.
import { useEffect, useState } from "react";
import "./PatientDashboard.css";
import { appointmentsApi, apptToDisplayRow } from "../lib/appointmentsApi";
import {
  Calendar,
  Pill,
  Activity,
  FileText,
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
import TopNav from "../components/TopNav";

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
  return (
    <div
      className={`summ-card${onClick ? " summ-card--clickable" : ""}`}
      onClick={onClick}
    >
      <div className="summ-icon">{icon}</div>
      <p className="summ-label">{label}</p>
      <p className="summ-value">{value}</p>
      {detail && <p className="summ-detail">{detail}</p>}
    </div>
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

  useEffect(() => {
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
  }, []);

  const [view, setView] = useState(() => {
    if (pageData?.intent === "labs" && pageData.labResultId)
      return "lab-detail";
    if (pageData?.intent === "labs") return "labs";
    return "home";
  });
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
  if (hour >= 6 && hour < 12) {
    greetingMes = "Good morning";
  } else if (hour >= 12 && hour < 18) {
    greetingMes = "Good afternoon";
  }
  const { unreadCount: unreadMessages } = useMessages();

  const navOption = [
    "Dashboard",
    "Appointments",
    "My Care Team",
    "Records",
    "Messages",
    "Pulse AI",
  ];

  return (
    <div className="p-dash">
      {/* Navigation bar */}
      <TopNav
        links={navOption.map((o) =>
          o === "Messages" ? { label: o, badge: unreadMessages } : o,
        )}
        activeKey={view === "home" ? "Dashboard" : "Records"}
        onLogoClick={() => setView("home")}
        onSelect={(label) => {
          if (label === "Dashboard") setView("home");
          else if (label === "Records") setView("labs");
          else if (label === "Appointments") onNavigate?.("appointments");
          else if (label === "Pulse AI") onNavigate?.("pulse");
          else if (label === "Messages") onNavigate?.("messages");
        }}
        userName={currentUser.fullName}
        userRole={currentUser.role}
        onSignOut={onSignOut}
      />

      {/* ── Main content ── */}
      <main className="dash-main">
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
            {/*  Header */}
            <div className="dash-header">
              <div>
                <p className="dash-date">{dateFormat}</p>
                <h1 className="dash-greeting">
                  {greetingMes}, {currentUser.firstName}
                </h1>
              </div>
              <button
                className="dash-book-btn"
                onClick={() => onNavigate?.("booking")}
              >
                <Plus size={16} /> Book Appointment
              </button>
            </div>

            {/* Top Four cards */}
            <div className="dash-sumcard">
              <SummaryCard
                icon={<Calendar size={16} />}
                label="Next Appointment"
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
                onClick={() => onNavigate?.("appointments")}
              />
              <SummaryCard
                icon={<Pill size={16} />}
                label="Active Medications"
                value="3"
                detail="Refill due May 28"
              />
              <SummaryCard
                icon={<Activity size={16} />}
                label="Recent Labs"
                value="4"
                detail="1 result flagged"
                onClick={() => setView("labs")}
              />
              <SummaryCard
                icon={<FileText size={16} />}
                label="Balance Due"
                value="$142"
                detail="Due Jun 1 · BCBS on file"
              />
            </div>

            {/* ── Middle layout ── */}
            <div className="dash-middle">
              {/* Upcoming Appointments */}
              <div className="dash-card">
                <div className="dash-card-header">
                  <h3 className="dash-card-title">Upcoming Appointments</h3>
                  <button
                    className="dash-view-all"
                    onClick={() => onNavigate?.("appointments")}
                  >
                    View all
                  </button>
                </div>
                {upcomingAppoint.length === 0 && (
                  <p className="dash-appt-empty">No upcoming appointments.</p>
                )}
                {upcomingAppoint.map((appt) => (
                  <button
                    key={appt.id}
                    className="dash-appt-row"
                    onClick={() => onNavigate?.("appointments")}
                  >
                    <div className="dash-appt-date">
                      <span className="dash-appt-month">{appt.month}</span>
                      <span className="dash-appt-day">{appt.day}</span>
                    </div>

                    <div className="dash-appt-divider" />

                    <div className="dash-appt-info">
                      <p className="dash-appt-doctor">{appt.doctor}</p>
                      <p className="dash-appt-specialty">{appt.specialty}</p>
                    </div>

                    <div className="dash-appt-time">
                      <span>{appt.time}</span>
                      <Stethoscope size={14} />
                    </div>

                    <ChevronRight size={16} className="dash-appt-arrow" />
                  </button>
                ))}
              </div>

              {/* ── Right sidebar ── */}
              <div className="dash-sidebar">
                {/* Medications */}
                <div className="dash-card">
                  <div className="dash-card-header">
                    <h3 className="dash-card-title">Active Medications</h3>
                    <button className="dash-view-all">View all</button>
                  </div>
                  {activeMed.map((med) => (
                    <div key={med.name} className="dash-med-row">
                      <div>
                        <p className="dash-med-name">{med.name}</p>
                        <p className="dash-med-detail">
                          {med.dose} · {med.frequency}
                        </p>
                      </div>
                      <span className="dash-med-refill">{med.refillDue}</span>
                    </div>
                  ))}
                </div>

                {/* ── Labs ── */}
                <div className="dash-card">
                  <div className="dash-card-header">
                    <h3 className="dash-card-title">Recent Labs</h3>
                    <button
                      className="dash-view-all"
                      onClick={() => setView("labs")}
                    >
                      View all
                    </button>
                  </div>
                  {labResult.map((lab) => {
                    let labNameClass = "dash-lab-name";
                    let labStatusClass = "dash-lab-status";

                    if (lab.flag) {
                      labNameClass = "dash-lab-name flagged";
                      labStatusClass = "dash-lab-status flagged";
                    }
                    {
                      /* flag lab result*/
                    }
                    return (
                      <div key={lab.test} className="dash-lab-row">
                        <div className="dash-lab-name-wrap">
                          {lab.flag && <span className="dash-lab-dot"></span>}

                          <p className={labNameClass}>{lab.test}</p>
                        </div>

                        <span className={labStatusClass}>{lab.result}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── AI Banner ── */}
            <div className="dash-ai-banner">
              <div className="dash-ai-icon">
                <MessageCircleQuestion size={22} />
              </div>
              <div className="dash-ai-text">
                <p className="dash-ai-title">
                  Pulse AI — built around your care
                </p>
                <p className="dash-ai-detail">
                  Ask about your upcoming visit, medication interactions, lab
                  results, or anything on your mind.
                </p>
              </div>
              <button
                className="dash-ai-btn"
                onClick={() => pulse.openDrawer()}
              >
                <MessageCircleQuestion size={16} /> Ask Pulse
              </button>
            </div>
          </>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="dash-footer">
        <div className="dash-footer-left">
          <span className="dash-logo">
            <u>HealthNest</u>
          </span>
          <p className="dash-footer-tag">
            Coordinated care across clinics,
            <br />
            built for patients and providers.
          </p>
        </div>
        <div className="dash-footer-links">
          <div>
            <p className="dash-footer-heading">PLATFORM</p>
            {[
              "Patient Portal",
              "Provider Tools",
              "AI Health Assistant",
              "Appointment Scheduling",
            ].map((l) => (
              <p key={l} className="dash-footer-link">
                {l}
              </p>
            ))}
          </div>
          <div>
            <p className="dash-footer-heading">SUPPORT</p>
            {[
              "Help Center",
              "Contact Us",
              "Privacy Policy",
              "Terms of Service",
            ].map((l) => (
              <p key={l} className="dash-footer-link">
                {l}
              </p>
            ))}
          </div>
        </div>
      </footer>
      <div className="dash-copyright">
        © 2026 HealthNest Technologies, Inc. All rights reserved.
      </div>
      {!pulse.drawerOpen && (
        <button
          className="dash-pulse-fab"
          onClick={() => pulse.openDrawer()}
          aria-label="Open Pulse AI"
        >
          <MessageCircleQuestion size={25} />
        </button>
      )}
    </div>
  );
}
