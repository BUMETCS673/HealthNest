import { useState } from "react";
import { User, Stethoscope, Check } from "lucide-react";
import { supabase } from "./lib/supabase";
import "./Login.css";

export default function Signup({ onSwitchToLogin, onSignedUp }) {
  const [role, setRole] = useState("patient");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dob, setDob] = useState("");
  const [sex, setSex] = useState("unknown");
  const [mrn, setMrn] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setInfo("");

    const metadata = {
      role,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
    };
    if (role === "patient") {
      metadata.date_of_birth = dob;
      metadata.sex_at_birth = sex;
      metadata.mrn = mrn.trim();
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata },
    });

    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (data.session) {
      onSignedUp?.(data.session);
    } else {
      setInfo(
        "Account created. Check your email to confirm before signing in."
      );
    }
  };

  return (
    <div className="login-root">
      <div className="login-left">
        <div className="login-logo">
          <u>HealthNest</u>
        </div>
        <div className="login-left-content">
          <h1 className="login-headline">
            Join HealthNest,{" "}
            <span className="login-headline-italic">in one step.</span>
          </h1>
          <p className="login-sub">
            Create a patient or provider account. Your information stays
            encrypted, and you control who sees what.
          </p>
        </div>
      </div>

      <div className="login-right">
        <div className="login-form-card">
          <h2 className="login-form-title">Create your account</h2>
          <p className="login-form-sub">
            Choose your account type, then fill in the basics.
          </p>

          <div className="login-role-selector">
            <button
              type="button"
              className={`login-role-btn ${role === "patient" ? "active" : ""}`}
              onClick={() => setRole("patient")}
            >
              <span
                className={`login-role-avatar ${role === "patient" ? "active" : ""}`}
              >
                <User size={20} />
              </span>
              <span className="login-role-label">Patient</span>
              <span className="login-role-desc">
                Manage your health and visits
              </span>
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
              <span
                className={`login-role-avatar ${role === "provider" ? "active" : ""}`}
              >
                <Stethoscope size={20} />
              </span>
              <span className="login-role-label">Provider</span>
              <span className="login-role-desc">
                Care for your patient panel
              </span>
              {role === "provider" && (
                <span className="login-role-check">
                  <Check size={12} strokeWidth={3} />
                </span>
              )}
            </button>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <div
              className="login-field"
              style={{ flexDirection: "row", gap: "0.75rem" }}
            >
              <div style={{ flex: 1 }}>
                <label className="login-label" htmlFor="firstName">
                  First name
                </label>
                <input
                  id="firstName"
                  className="login-input"
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="login-label" htmlFor="lastName">
                  Last name
                </label>
                <input
                  id="lastName"
                  className="login-input"
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>

            {role === "patient" && (
              <div className="login-field">
                <label className="login-label" htmlFor="mrn">
                  Medical record number (MRN)
                </label>
                <input
                  id="mrn"
                  className="login-input"
                  type="text"
                  required
                  value={mrn}
                  onChange={(e) => setMrn(e.target.value)}
                  placeholder="e.g. MRN-00123456"
                />
              </div>
            )}

            {role === "patient" && (
              <div
                className="login-field"
                style={{ flexDirection: "row", gap: "0.75rem" }}
              >
                <div style={{ flex: 1 }}>
                  <label className="login-label" htmlFor="dob">
                    Date of birth
                  </label>
                  <input
                    id="dob"
                    className="login-input"
                    type="date"
                    required
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="login-label" htmlFor="sex">
                    Sex at birth
                  </label>
                  <select
                    id="sex"
                    className="login-input"
                    value={sex}
                    onChange={(e) => setSex(e.target.value)}
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="intersex">Intersex</option>
                    <option value="unknown">Prefer not to say</option>
                  </select>
                </div>
              </div>
            )}

            <div className="login-field">
              <label className="login-label" htmlFor="signupEmail">
                Email address
              </label>
              <input
                id="signupEmail"
                className="login-input"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="login-field">
              <label className="login-label" htmlFor="signupPassword">
                Password
              </label>
              <div className="login-input-wrap">
                <input
                  id="signupPassword"
                  className="login-input"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={6}
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
            {info && (
              <p
                className="login-error"
                style={{
                  color: "#1f7a3a",
                  background: "#eaf6ee",
                  borderColor: "#bfe0c8",
                }}
              >
                {info}
              </p>
            )}

            <button
              type="submit"
              className="login-submit"
              disabled={loading}
            >
              {loading
                ? "Creating account…"
                : `Create ${role === "patient" ? "patient" : "provider"} account`}
            </button>
          </form>

          <div className="login-divider">
            <span>Already have an account?</span>
          </div>

          <button
            type="button"
            className="login-register"
            onClick={onSwitchToLogin}
          >
            Sign in instead
          </button>
        </div>
      </div>
    </div>
  );
}
