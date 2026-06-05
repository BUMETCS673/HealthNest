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
import Login from "./Login";
import Signup from "./Signup";
import PatientDashboard from "./PatientDashboard";
import DoctorDashboard from "./DoctorDashboard";
import AppointmentsPage from "./AppointmentsPage";
import BookingPage from "./BookingPage";
import PulseProvider from "./pulse/PulseProvider";
import PulseDrawer from "./pulse/PulseDrawer";
import PulseWorkspace from "./pulse/PulseWorkspace";
import MessagesPage from "./MessagesPage";
import { authApi } from "./lib/authApi";

const PATH_TO_PAGE = {
  "/appointments": "appointments",
  "/booking": "booking",
  "/pulse": "pulse",
  "/messages": "messages",
};

const PAGE_TO_PATH = {
  dashboard: "/",
  appointments: "/appointments",
  booking: "/booking",
  pulse: "/pulse",
  messages: "/messages",
};

function getPageFromPath() {
  return PATH_TO_PAGE[window.location.pathname] ?? "dashboard";
}

export default function App() {
  const [view, setView] = useState("login");
  const [page, setPage] = useState(getPageFromPath);
  const [pageData, setPageData] = useState(null);
  const [session, setSession] = useState(() => authApi.getSession());

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

  const handleSignOut = () => {
    authApi.signOut();
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
      session.user?.user_metadata?.role ??
      session.user?.raw_user_meta_data?.role ??
      "patient";
    const sharedProps = {
      user: session.user,
      onNavigate: handleNavigate,
      onSignOut: handleSignOut,
    };

    if (role === "provider") {
      return <DoctorDashboard user={session.user} onSignOut={handleSignOut} />;
    }

    const patientPage = (() => {
      if (page === "appointments") return <AppointmentsPage {...sharedProps} />;
      if (page === "messages") return <MessagesPage {...sharedProps} />;
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

    return (
      <PulseProvider>
        {patientPage}
        <PulseDrawer
          onOpenWorkspace={() => handleNavigate("pulse")}
          onNavigate={handleNavigate}
        />
      </PulseProvider>
    );
  }

  return view === "signup" ? (
    <Signup
      onSwitchToLogin={() => setView("login")}
      onSignedUp={(s) => setSession(s)}
    />
  ) : (
    <Login
      onSwitchToSignup={() => setView("signup")}
      onSignedIn={(s) => setSession(s)}
    />
  );
}
