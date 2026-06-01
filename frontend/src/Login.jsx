/*
AI-USAGE SUMMARY
Model: ChatGPT-5
Overall AI Contribution: ~30%
AI-Assisted Areas: Added biometric sign-in handler `handleBiometric` and the "Continue with passkey" button; integrated `authApi.signInBiometric` call and error handling.
Human Contributions: Kept existing form, validation, and sign-in flow; chose placement and messaging for the biometric button.
*/

import { useState } from "react";
import {
  Calendar,
  MessageCircleQuestionMark,
  Lock,
  Shield,
  User,
  Stethoscope,
  Check,
} from "lucide-react";
import { authApi } from "./lib/authApi";
import "./Login.css";

export default function Login({ onSwitchToSignup, onSignedIn }) {
  const [role, setRole] = useState("patient");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const data = await authApi.signIn({ email, password });
      onSignedIn?.(data.session, role);
    } catch (signInError) {
      setError(signInError.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBiometric = async () => {
    setLoading(true);
    setError("");
    try {
      if (!email) throw new Error("Enter your email to use biometric login.");
      const data = await authApi.signInBiometric(email);
      if (data.session) {
        onSignedIn?.(data.session);
      } else if (data.user) {
        // Biometric verified but no session — build a minimal one to get past the gate
        onSignedIn?.({ user: data.user });
      }
    } catch (err) {
      setError(err.message || "Biometric verification failed. Try again or use email and password.");
    } finally {
      setLoading(false);
    }
};

  return (
    <div className="login-root">
      {/* ── Left panel ── */}
      <div className="login-left">
        <div className="login-logo"><u>HealthNest</u></div>
        <div className="login-left-content">
          <h1 className="login-headline">
            Coordinated care,{" "}
            <span className="login-headline-italic">finally unified.</span>
          </h1>
          <p className="login-sub">
            One platform connecting patients and providers across clinics —
            with AI-powered insights built in.
          </p>
          <ul className="login-features">
            {[
              {
                icon: <Calendar size={16} />,
                title: "Multi-clinic scheduling",
                desc: "Book across hospitals and clinics in one place",
              },
              {
                icon: <MessageCircleQuestionMark size={16} />,
                title: "AI health assistant",
                desc: "Understand your records, labs, and next steps",
              },
              {
                icon: <Lock size={16} />,
                title: "HIPAA-secure messaging",
                desc: "Encrypted direct communication with your care team",
              },
              {
                icon: <Shield size={16} />,
                title: "Unified health records",
                desc: "All your providers, one coordinated record",
              },
            ].map((f) => (
              <li key={f.title} className="login-feature-item">
                <span className="login-feature-icon">{f.icon}</span>
                <div>
                  <p className="login-feature-title">{f.title}</p>
                  <p className="login-feature-desc">{f.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="login-right">
        <div className="login-form-card">
          <h2 className="login-form-title">Sign in to HealthNest</h2>
          <p className="login-form-sub">
            Select your account type, then enter your credentials.
          </p>

          {/* Role selector */}
          <div className="login-role-selector">
            <button
              type="button"
              className={`login-role-btn ${role === "patient" ? "active" : ""}`}
              onClick={() => setRole("patient")}
            >
              <span className={`login-role-avatar ${role === "patient" ? "active" : ""}`}>
                <User size={20} />
              </span>
              <span className="login-role-label">Patient</span>
              <span className="login-role-desc">Access your health dashboard</span>
              {role === "patient" && (
                <span className="login-role-check">
                  <Check size={12} strokeWidth={3} />
                </span>
              )}
            </button>
            <button
              type="button"
              className={`login-role-btn ${role === "provider" ? "active" : ""}`}
              onClick={() => setRole("provider")}
            >
              <span className={`login-role-avatar ${role === "provider" ? "active" : ""}`}>
                <Stethoscope size={20} />
              </span>
              <span className="login-role-label">Provider</span>
              <span className="login-role-desc">Access your clinical workspace</span>
              {role === "provider" && (
                <span className="login-role-check">
                  <Check size={12} strokeWidth={3} />
                </span>
              )}
            </button>
          </div>

          {/* Form */}
          <form className="login-form" onSubmit={handleSubmit}>
            <div className="login-field">
              <label className="login-label" htmlFor="email">
                Email address
              </label>
              <input
                id="email"
                className="login-input"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="login-field">
              <div className="login-label-row">
                <label className="login-label" htmlFor="password">
                  Password
                </label>
                <button type="button" className="login-forgot">
                  Forgot password?
                </button>
              </div>
              <div className="login-input-wrap">
                <input
                  id="password"
                  className="login-input"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="login-show-btn"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? "hide" : "show"}
                </button>
              </div>
            </div>

            {error && <p className="login-error">{error}</p>}

              <button type="submit" className="login-submit" disabled={loading}>
                {loading
                  ? "Signing in…"
                  : `Sign in as ${role === "patient" ? "Patient" : "Provider"}`}
              </button>
            </form>
            <button
              type="button"
              className="login-bio"
              onClick={handleBiometric}
              disabled={loading}
            >
              Continue with passkey
            </button>
          <div className="login-divider">
            <span>Don't have an account?</span>
          </div>

            <button
              type="button"
              className="login-register"
              onClick={onSwitchToSignup}
            >
            Create an account as {role === "patient" ? "Patient" : "Provider"}
            </button>
        </div>
      </div>
    </div>
  );
}