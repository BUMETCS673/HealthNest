// AI-USAGE SUMMARY
// Tools: Claude Code, Opus 4.7
// Overall AI Contribution: ~60%
// AI-Assisted Areas: Setting up the main application component, handling authentication state, and routing between
// different pages based on user actions and URL paths. Opus 4.7 added the /pulse route, wrapped the signed-in tree in PulseProvider, and mounted the PulseDrawer once at App level so any patient page can open it.
// Human Contributions: Defining the overall structure of the application, integrating authentication logic, and ensuring that
// navigation and state management work correctly. Owned the decision to mount the drawer at App level (portal-style) so the conversation state survives navigating between dashboard / appointments / pulse routes.
// Notes: AI was used to help quickly set up the main application component and to implement the core logic for handling
// authentication state and routing.

import { useEffect, useState } from "react";
import Login from "./loginsignup/Login";
import Signup from "./loginsignup/Signup";
import PatientDashboard from "./patient/PatientDashboard";
import DoctorDashboard from "./doctor/DoctorDashboard";
import AppointmentsPage from "./appointments/AppointmentsPage";
import AppointmentDetailPage from "./appointments/AppointmentDetailPage";
import BookingPage from "./booking/BookingPage";
import CareTeamPage from "./careteam/CareTeamPage";
import PulseProvider from "./pulse/PulseProvider";
import PulseDrawer from "./pulse/PulseDrawer";
import PulseWorkspace from "./pulse/PulseWorkspace";
import MessagesPage from "./messages/MessagesPage";
import MessagesProvider from "./messages/MessagesProvider";
import MessagesDrawer from "./messages/MessagesDrawer";
import { authApi } from "./lib/authApi";
import DfaProvider from "./pulse/DfaProvider";
import DfaDrawer from "./pulse/DfaDrawer";
import DfaWorkspace from "./pulse/DfaWorkspace";

const PATH_TO_PAGE = {
  "/appointments": "appointments",
  "/booking": "booking",
  "/care-team": "care-team",
  "/pulse": "pulse",
  "/messages": "messages",
  // provider routes
  "/schedule": "schedule",
  "/patient-records": "patient-records",
};

const PAGE_TO_PATH = {
  dashboard: "/",
  appointments: "/appointments",
  // Detail state lives in pageData; back/refresh land on the list.
  "appointment-detail": "/appointments",
  booking: "/booking",
  "care-team": "/care-team",
  pulse: "/pulse",
  messages: "/messages",
  "dfa-pulse": "/pulse",
  // provider routes
  schedule: "/schedule",
  "patient-records": "/patient-records",
};

// Provider top-level pages → the DoctorDashboard internal view they open.
const PROVIDER_PAGE_TO_VIEW = {
  dashboard: "home",
  schedule: "schedule",
  "patient-records": "labs",
  messages: "messages",
};

function getPageFromPath() {
  return PATH_TO_PAGE[window.location.pathname] ?? "dashboard";
}

const ACTIVE_ROLE_KEY = "healthnest.activeRole";

export default function App() {
  const [view, setView] = useState("login");
  const [page, setPage] = useState(getPageFromPath);
  const [pageData, setPageData] = useState(null);
  const [session, setSession] = useState(() => authApi.getSession());
  const [signupRole, setSignupRole] = useState("patient");
  const [activeRole, setActiveRole] = useState(() =>
    localStorage.getItem(ACTIVE_ROLE_KEY)
  );

  const rememberRole = (role) => {
    if (!role) return;
    localStorage.setItem(ACTIVE_ROLE_KEY, role);
    setActiveRole(role);
  };

  // Strip Supabase tokens from the URL hash (left over from email confirmation redirects)
  useEffect(() => {
    if (window.location.hash.includes("access_token")) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    authApi.fetchUser().then((user) => {
      if (!user) {
        setSession(null);
        return;
      }
      const stored = authApi.getSession();
      if (stored) setSession({ ...stored, user });
    });
    return authApi.onAuthStateChange((s) => setSession(s));
  }, []);

  // Keep page state in sync when the user hits browser back/forward
  useEffect(() => {
    const onPop = () => setPage(getPageFromPath());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Proactively refresh the access token before it expires (the timer
  // checks the stored session itself, so it's a no-op when signed out)
  useEffect(() => {
    authApi.startAutoRefresh();
    return () => authApi.stopAutoRefresh();
  }, []);

  const handleSignOut = () => {
    authApi.signOut();
    localStorage.removeItem(ACTIVE_ROLE_KEY);
    setActiveRole(null);
    setSession(null);
    setPage("dashboard");
    setPageData(null);
    window.history.pushState(null, "", "/");
  };

  const handleNavigate = (newPage, data = null) => {
    if (newPage === "labs") {
      setPage("dashboard");
      setPageData({ intent: "labs", ...(data || {}) });
      window.history.pushState(null, "", "/");
      return;
    }
    setPage(newPage);
    setPageData(data);
    window.history.pushState(null, "", PAGE_TO_PATH[newPage] ?? "/");
  };

  if (session) {
    const role =
      activeRole ??
      session.user?.user_metadata?.role ??
      session.user?.raw_user_meta_data?.role ??
      "patient";
    const sharedProps = {
      user: session.user,
      onNavigate: handleNavigate,
      onSignOut: handleSignOut,
    };

    if (role === "provider") {
      const providerPage = (() => {
        if (page === "dfa-pulse")
          return (
            <DfaWorkspace
              user={session.user}
              onNavigate={handleNavigate}
              onSignOut={handleSignOut}
            />
          );
        return (
          <DoctorDashboard
            user={session.user}
            onSignOut={handleSignOut}
            onNavigate={handleNavigate}
            initialView={
              PROVIDER_PAGE_TO_VIEW[page] ?? pageData?.providerView ?? "home"
            }
          />
        );
      })();

      return (
        <DfaProvider>
          {providerPage}
          <DfaDrawer onNavigate={handleNavigate} />
        </DfaProvider>
      );
    }

    const patientPage = (() => {
      if (page === "appointment-detail") {
        return (
          <AppointmentDetailPage
            {...sharedProps}
            appointmentId={pageData?.appointmentId ?? null}
            initialAppointment={pageData?.appointment ?? null}
          />
        );
      }
      if (page === "appointments") return <AppointmentsPage {...sharedProps} />;
      if (page === "care-team") return <CareTeamPage {...sharedProps} />;
      if (page === "messages")
        return (
          <MessagesPage
            {...sharedProps}
            initialContactId={pageData?.openContactId}
          />
        );
      if (page === "booking") {
        return (
          <BookingPage
            {...sharedProps}
            appointments={pageData?.appointments ?? null}
          />
        );
      }
      if (page === "pulse") return <PulseWorkspace {...sharedProps} />;
      return <PatientDashboard {...sharedProps} pageData={pageData} />;
    })();

    const signedInTree =
      role === "provider" ? (
        <DoctorDashboard user={session.user} onSignOut={handleSignOut} />
      ) : (
        <PulseProvider>
          {patientPage}
          <PulseDrawer
            onOpenWorkspace={() => handleNavigate("pulse")}
            onNavigate={handleNavigate}
            hideLauncher={page === "pulse"}
          />
          <MessagesDrawer
            myId={session.user?.id}
            onOpenMessages={() => handleNavigate("messages")}
            hideLauncher={page === "messages"}
          />
        </PulseProvider>
      );

    // Mount the messaging provider around the whole signed-in tree so the
    // Realtime subscription + unread state are available on every page.
    return (
      <MessagesProvider session={session}>{signedInTree}</MessagesProvider>
    );
  }

  return view === "signup" ? (
    <Signup
      key={signupRole}
      initialRole={signupRole}
      onSwitchToLogin={() => setView("login")}
      onSignedUp={(s, role) => {
        rememberRole(role);
        setSession(s);
      }}
    />
  ) : (
    <Login
      onSwitchToSignup={(role) => {
        setSignupRole(role);
        setView("signup");
      }}
      onSignedIn={(s, role) => {
        rememberRole(role);
        setSession(s);
      }}
    />
  );
}
