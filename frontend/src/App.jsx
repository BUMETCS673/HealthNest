import { useEffect, useState } from "react";
import Login from "./Login";
import Signup from "./Signup";
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
    return (
      <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
        <h2>Signed in as {session.user.email}</h2>
        <pre style={{ fontSize: 12, background: "#f4f4f2", padding: "1rem" }}>
          {JSON.stringify(session.user.user_metadata, null, 2)}
        </pre>
        <button onClick={() => authApi.signOut()}>Sign out</button>
      </div>
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
