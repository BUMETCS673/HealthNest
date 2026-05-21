import "./PatientDashboard.css";
import {
  Calendar,
  Pill,
  Activity,
  FileText,
  ChevronRight,
  Plus,
  MessageCircleQuestion,
  Stethoscope,
  Bell,
  User,
  ChevronDown,
} from "lucide-react";

function formatRole(role) {
  if (!role) return "Patient";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function deriveCurrentUser(user) {
  const metadata = user?.user_metadata ?? {};
  const firstName = metadata.first_name?.trim() || "";
  const lastName = metadata.last_name?.trim() || "";
  const fullName =
    [firstName, lastName].filter(Boolean).join(" ") ||
    user?.email ||
    "Patient";
  return {
    firstName: firstName || fullName.split(" ")[0] || "there",
    fullName,
    role: formatRole(metadata.role),
  };
}

const upcomingAppoint = [
  {
    id: 1,
    month: "May",
    day: "20",
    doctor: "Dr. Marcus Johnson",
    specialty: "Cardiology",
    date: "May 20, 2026",
    time: "2:00 PM",
    address: "Brigham and Women's Hospital, Suite 301",
  },
  {
    id: 2,
    month: "Jun",
    day: "3",
    doctor: "Dr. Emily Park",
    specialty: "Primary Care",
    date: "Jun 3, 2026",
    time: "10:30 AM",
    address: "Boston Medical Center, Suite 204",
  },
  {
    id: 3,
    month: "Jun",
    day: "17",
    doctor: "Dr. Alan Mercer",
    specialty: "Endocrinology",
    date: "Jun 17, 2026",
    time: "9:00 AM",
    address: "Boston Medical Center, Suite 812",
  },
];

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

const labResult = [
  { test: "CBC Panel", result: "Normal", flag: false },
  { test: "HbA1c", result: "6.4%", flag: true }, // example of how a not normal lab result looks like
  { test: "Lipid Panel", result: "Normal", flag: false },
  { test: "TSH", result: "Normal", flag: false },
];

function SummaryCard({ icon, label, value, detail }) {
  return (
    <div className='summ-card'>
      <div className='summ-icon'>{icon}</div>
      <p className='summ-label'>{label}</p>
      <p className='summ-value'>{value}</p>
      {detail && <p className='summ-detail'>{detail}</p>}
    </div>
  );
}

export default function PatientDashboard({ user }) {
  const currentUser = deriveCurrentUser(user);
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
  const unreadMessages = 0; // will be replaced with db later

  const navOption = [
    "Dashboard",
    "Appointments",
    "Records",
    "Messages",
    "Pulse AI",
  ];

  return (
    <div className='p-dash'>
      {/* Navigation bar */}
      <nav className='dash-nav'>
        {/* Left side includes logo and all navigation options */}
        <div className='dash-nav-left'>
          <span className='dash-logo'>
            <u>HealthNest</u>
          </span>

          {navOption.map((option) => {
            const buttonClass =
              option === "Dashboard" ? "dash-nav-link active" : "dash-nav-link";

            const showMessageBadge =
              option === "Messages" && unreadMessages > 0;

            return (
              <button key={option} className={buttonClass}>
                {option}

                {showMessageBadge && (
                  <span className='dash-badge'>{unreadMessages}</span>
                )}
              </button>
            );
          })}
        </div>

        {/*right side includes notif bell + user profile*/}
        <div className='dash-nav-right'>
          <button className='dash-icon-btn'>
            <Bell size={20} />
          </button>
          <div className='dash-user'>
            <div className='dash-avatar'>
              <User size={16} />
            </div>
            <div className='dash-user-info'>
              {/*temp*/}
              <span className='dash-user-name'>{currentUser.fullName}</span>
              <span className='dash-user-role'>{currentUser.role}</span>
            </div>
            <ChevronDown size={16} />
          </div>
        </div>
      </nav>

      {/* ── Main content ── */}
      <main className='dash-main'>
        {/*  Header */}
        <div className='dash-header'>
          <div>
            <p className='dash-date'>{dateFormat}</p>
            <h1 className='dash-greeting'>
              {greetingMes}, {currentUser.firstName}
            </h1>
          </div>
          <button className='dash-book-btn'>
            <Plus size={16} /> Book Appointment
          </button>
        </div>

        {/* Top Four cards */}
        <div className='dash-sumcard'>
          <SummaryCard
            icon={<Calendar size={16} />}
            label='Next Appointment'
            value='May 20'
            detail='Dr. Johnson · Cardiology'
          />
          <SummaryCard
            icon={<Pill size={16} />}
            label='Active Medications'
            value='3'
            detail='Refill due May 28'
          />
          <SummaryCard
            icon={<Activity size={16} />}
            label='Recent Labs'
            value='4'
            detail='1 result flagged'
          />
          <SummaryCard
            icon={<FileText size={16} />}
            label='Balance Due'
            value='$142'
            detail='Due Jun 1 · BCBS on file'
          />
        </div>

        {/* ── Middle layout ── */}
        <div className='dash-middle'>
          {/* Upcoming Appointments */}
          <div className='dash-card'>
            <div className='dash-card-header'>
              <h3 className='dash-card-title'>Upcoming Appointments</h3>
              <button className='dash-view-all'>View all</button>
            </div>
            {upcomingAppoint.map((appt) => (
              <div key={appt.id} className='dash-appt-row'>
                <div className='dash-appt-date'>
                  <span className='dash-appt-month'>{appt.month}</span>
                  <span className='dash-appt-day'>{appt.day}</span>
                </div>

                <div className='dash-appt-divider' />

                <div className='dash-appt-info'>
                  <p className='dash-appt-doctor'>{appt.doctor}</p>
                  <p className='dash-appt-specialty'>
                    {appt.specialty} · {appt.address}
                  </p>
                </div>

                <div className='dash-appt-time'>
                  <span>{appt.time}</span>
                  <Stethoscope size={14} />
                </div>

                <ChevronRight size={16} className='dash-appt-arrow' />
              </div>
            ))}
          </div>

          {/* ── Right sidebar ── */}
          <div className='dash-sidebar'>
            {/* Medications */}
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

            {/* ── Labs ── */}
            <div className='dash-card'>
              <div className='dash-card-header'>
                <h3 className='dash-card-title'>Recent Labs</h3>
                <button className='dash-view-all'>View all</button>
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
                  <div key={lab.test} className='dash-lab-row'>
                    <div className='dash-lab-name-wrap'>
                      {lab.flag && <span className='dash-lab-dot'></span>}

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
        <div className='dash-ai-banner'>
          <div className='dash-ai-icon'>
            <MessageCircleQuestion size={22} />
          </div>
          <div className='dash-ai-text'>
            <p className='dash-ai-title'>Pulse AI — built around your care</p>
            <p className='dash-ai-detail'>
              Ask about your upcoming visit, medication interactions, lab
              results, or anything on your mind.
            </p>
          </div>
          <button className='dash-ai-btn'>
            <MessageCircleQuestion size={16} /> Ask Pulse
          </button>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className='dash-footer'>
        <div className='dash-footer-left'>
          <span className='dash-logo'>
            <u>HealthNest</u>
          </span>
          <p className='dash-footer-tag'>
            Coordinated care across clinics,
            <br />
            built for patients and providers.
          </p>
        </div>
        <div className='dash-footer-links'>
          <div>
            <p className='dash-footer-heading'>PLATFORM</p>
            {[
              "Patient Portal",
              "Provider Tools",
              "AI Health Assistant",
              "Appointment Scheduling",
            ].map((l) => (
              <p key={l} className='dash-footer-link'>
                {l}
              </p>
            ))}
          </div>
          <div>
            <p className='dash-footer-heading'>SUPPORT</p>
            {[
              "Help Center",
              "Contact Us",
              "Privacy Policy",
              "Terms of Service",
            ].map((l) => (
              <p key={l} className='dash-footer-link'>
                {l}
              </p>
            ))}
          </div>
        </div>
      </footer>
      <div className='dash-copyright'>
        © 2026 HealthNest Technologies, Inc. All rights reserved.
      </div>
      {/* ── Floating AI button ── */}
      <button className='dash-pulse-fab'>
        <MessageCircleQuestion size={25} />
      </button>
    </div>
  );
}
