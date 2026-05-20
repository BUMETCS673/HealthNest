import { useEffect, useState } from "react";
import Login from "./Login";
import Signup from "./Signup";
import { supabase } from "./lib/supabase";

export default function App() {
  const [view, setView] = useState("login");
  const [session, setSession] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) =>
      setSession(s)
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session) {
    return (
      <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
        <h2>Signed in as {session.user.email}</h2>
        <pre style={{ fontSize: 12, background: "#f4f4f2", padding: "1rem" }}>
          {JSON.stringify(session.user.user_metadata, null, 2)}
        </pre>
        <button onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>
    );
  }

  return view === "signup" ? (
    <Signup onSwitchToLogin={() => setView("login")} />
  ) : (
    <Login onSwitchToSignup={() => setView("signup")} />
  );
}
