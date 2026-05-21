import { useEffect, useState } from "react";
import Login from "./Login";
import Signup from "./Signup";
import PatientDashboard from "./PatientDashboard";
import { authApi } from "./lib/authApi";

export default function App() {
  const [view, setView] = useState("login");
  const [session, setSession] = useState(() => authApi.getSession());

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

  if (session) {
    const role = session.user?.user_metadata?.role ?? "patient";
    const handleSignOut = () => authApi.signOut();

    if (role === "provider") {
      return (
        <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
          <h2>Provider dashboard coming soon</h2>
          <p>Signed in as {session.user.email}</p>
          <button onClick={handleSignOut}>Sign out</button>
        </div>
      );
    }

    return <PatientDashboard user={session.user} onSignOut={handleSignOut} />;
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
