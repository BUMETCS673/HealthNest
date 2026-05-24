import { useEffect, useState } from "react";
import Login from "./Login";
import Signup from "./Signup";
import PatientDashboard from "./PatientDashboard";
import DoctorDashboard from "./DoctorDashboard";
import AppointmentsPage from "./AppointmentsPage";
import BookingPage from "./BookingPage";
import { authApi } from "./lib/authApi";

const PATH_TO_PAGE = {
  "/appointments": "appointments",
  "/booking": "booking",
};

const PAGE_TO_PATH = {
  dashboard: "/",
  appointments: "/appointments",
  booking: "/booking",
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
    setPage("dashboard");
    setPageData(null);
    window.history.pushState(null, "", "/");
  };

  const handleNavigate = (newPage, data = null) => {
    setPage(newPage);
    setPageData(data);
    window.history.pushState(null, "", PAGE_TO_PATH[newPage] ?? "/");
  };

  if (session) {
    const role = session.user?.user_metadata?.role ?? "patient";
    const sharedProps = {
      user: session.user,
      onNavigate: handleNavigate,
      onSignOut: handleSignOut,
    };

    if (role === "provider") {
      return <DoctorDashboard user={session.user} onSignOut={handleSignOut} />;
    }

    if (page === "appointments") {
      return <AppointmentsPage {...sharedProps} />;
    }

    if (page === "booking") {
      return <BookingPage {...sharedProps} appointments={pageData?.appointments ?? null} />;
    }

    return <PatientDashboard {...sharedProps} />;
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
