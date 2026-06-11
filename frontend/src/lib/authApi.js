/*
AI-USAGE SUMMARY
Model: ChatGPT-5
Overall AI Contribution: ~45%
AI-Assisted Areas: Added WebAuthn helpers (`_b64ToBuffer`, `_bufferToB64`) and the `enableBiometricLogin` / `signInBiometric` flows that convert ArrayBuffers and call backend endpoints.
Human Contributions: Preserved existing session read/write logic and error handling; integrated flows to reuse existing `request` helper.
*/

const API_URL =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:8000";
const SESSION_STORAGE_KEY = "healthnest.session";

const listeners = new Set();

function readStoredSession() {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStoredSession(session) {
  if (session) {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  }
  listeners.forEach((cb) => cb(session));
}

async function request(path, { method = "GET", body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail =
      typeof data.detail === "string"
        ? data.detail
        : data.detail?.[0]?.msg || res.statusText;
    throw new Error(detail);
  }
  return data;
}

// ── Token refresh ─────────────────────────────────────────────
let refreshPromise = null;
let autoRefreshTimer = null;

function decodeJwtExp(token) {
  try {
    const part = token.split(".")[1] || "";
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

function isExpiringSoon(token, skewSeconds = 60) {
  const exp = decodeJwtExp(token);
  if (!exp) return false; // unreadable → rely on the reactive 401-retry instead
  return exp * 1000 <= Date.now() + skewSeconds * 1000;
}

// Single-flight refresh: concurrent callers share one in-flight request, so a
// burst of dashboard calls can't fire (and rotate) multiple refresh tokens.
function doRefresh() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const session = readStoredSession();
      if (!session?.refresh_token) return null;
      try {
        const data = await request("/auth/refresh", {
          method: "POST",
          body: { refresh_token: session.refresh_token },
        });
        if (data?.session) {
          writeStoredSession(data.session);
          return data.session;
        }
        writeStoredSession(null);
        return null;
      } catch {
        writeStoredSession(null); // refresh failed → force re-login
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

export const authApi = {
  getSession() {
    return readStoredSession();
  },

  onAuthStateChange(callback) {
    listeners.add(callback);
    return () => listeners.delete(callback);
  },

  async signUp({ email, password, metadata }) {
    const data = await request("/auth/signup", {
      method: "POST",
      body: { email, password, ...metadata },
    });
    if (data.session) writeStoredSession(data.session);
    return data;
  },

  async signIn({ email, password }) {
    const data = await request("/auth/signin", {
      method: "POST",
      body: { email, password },
    });
    if (data.session) writeStoredSession(data.session);
    return data;
  },

  async signOut() {
    const session = readStoredSession();
    if (session?.access_token) {
      try {
        await request("/auth/signout", {
          method: "POST",
          token: session.access_token,
        });
      } catch {
        /* ignore — clear locally anyway */
      }
    }
    writeStoredSession(null);
  },

  // Force a refresh (used by the data clients' 401-retry path). Single-flight.
  refreshSession() {
    return doRefresh();
  },

  // Returns a non-expired access token, proactively refreshing if it's within
  // the skew window. Data clients call this before each request.
  async getValidAccessToken() {
    const session = readStoredSession();
    if (!session?.access_token) return null;
    if (isExpiringSoon(session.access_token)) {
      const refreshed = await doRefresh();
      return refreshed?.access_token ?? null;
    }
    return session.access_token;
  },

  // Background safety net: refresh shortly before expiry even when idle.
  startAutoRefresh() {
    if (autoRefreshTimer) return;
    autoRefreshTimer = setInterval(() => {
      const session = readStoredSession();
      if (session?.access_token && isExpiringSoon(session.access_token, 120)) {
        doRefresh();
      }
    }, 60 * 1000);
  },

  stopAutoRefresh() {
    if (autoRefreshTimer) {
      clearInterval(autoRefreshTimer);
      autoRefreshTimer = null;
    }
  },

  async fetchUser() {
    const session = readStoredSession();
    if (!session?.access_token) return null;
    try {
      return await request("/auth/me", { token: session.access_token });
    } catch {
      writeStoredSession(null);
      return null;
    }
  },

  // --- WebAuthn / Biometric helpers ---
  _b64ToBuffer(b64url) {
    const padding = "=".repeat((4 - (b64url.length % 4)) % 4);
    const base64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + padding;
    const raw = atob(base64);
    const buf = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; ++i) buf[i] = raw.charCodeAt(i);
    return buf.buffer;
  },

  _bufferToB64(buf) {
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++)
      binary += String.fromCharCode(bytes[i]);
    const b64 = btoa(binary)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    return b64;
  },

  async enableBiometricLogin() {
    const token = await this.getValidAccessToken();
    if (!token) throw new Error("Not signed in");

    // Start registration
    const start = await request("/auth/biometric/register/start", {
      method: "POST",
      token,
    });

    const publicKey = start.options;
    // Convert challenge and user.id from base64url to ArrayBuffer
    publicKey.challenge = this._b64ToBuffer(publicKey.challenge);
    if (publicKey.user && publicKey.user.id)
      publicKey.user.id = this._b64ToBuffer(publicKey.user.id);
    publicKey.userVerification = "discouraged";
    const credential = await navigator.credentials.create({ publicKey });
    if (!credential) throw new Error("Credential creation cancelled");

    // Prepare credential for server (convert ArrayBuffers to base64url)
    const clientDataJSON = this._bufferToB64(
      credential.response.clientDataJSON,
    );
    const attestation = this._bufferToB64(
      credential.response.attestationObject,
    );

    const res = await request("/auth/biometric/register/finish", {
      method: "POST",
      token,
      body: {
        credential: {
          id: credential.id,
          rawId: this._bufferToB64(credential.rawId),
          response: { clientDataJSON, attestation },
          type: credential.type,
        },
      },
    });
    return res;
  },

  async signInBiometric(email) {
    if (!email) throw new Error("Email required for biometric sign-in");
    const start = await request("/auth/biometric/login/start", {
      method: "POST",
      body: { email },
    });

    const publicKey = start.options;
    publicKey.challenge = this._b64ToBuffer(publicKey.challenge);
    if (publicKey.allowCredentials)
      publicKey.allowCredentials = publicKey.allowCredentials.map((c) => ({
        ...c,
        id: this._b64ToBuffer(c.id),
      }));
    publicKey.userVerification = "discouraged";
    let assertion;
    assertion = await Promise.race([
      navigator.credentials.get({ publicKey }),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Passkey timed out after 30s")),
          30000,
        ),
      ),
    ]);
    if (!assertion) throw new Error("Credential assertion cancelled");

    const authenticatorData = this._bufferToB64(
      assertion.response.authenticatorData,
    );
    const clientDataJSON = this._bufferToB64(assertion.response.clientDataJSON);
    const signature = this._bufferToB64(assertion.response.signature);
    const userHandle = assertion.response.userHandle
      ? this._bufferToB64(assertion.response.userHandle)
      : null;

    const res = await request("/auth/biometric/login/finish", {
      method: "POST",
      body: {
        email,
        credential: {
          id: assertion.id,
          rawId: this._bufferToB64(assertion.rawId),
          response: {
            clientDataJSON,
            authenticatorData,
            signature,
            userHandle,
          },
          type: assertion.type,
        },
      },
    });

    if (res.session?.access_token) {
      writeStoredSession(res.session);
    }

    return res;
  },

  async updateProfile({ first_name, last_name }) {
    const session = readStoredSession();
    if (!session?.access_token) throw new Error("Not signed in");
    const data = await request("/auth/profile", {
      method: "PATCH",
      token: session.access_token,
      body: { first_name, last_name },
    });
    // Update the stored session's user_metadata so the name reflects
    if (session.user) {
      session.user.user_metadata = {
        ...session.user.user_metadata,
        first_name,
        last_name,
      };
      writeStoredSession(session);
    }
    return data;
  },

  async updatePassword(currentPassword, newPassword) {
    const token = await this.getValidAccessToken();

    if (!token) throw new Error("Not signed in");

    return await request("/auth/password", {
      method: "PATCH",
      token,
      body: { current_password: currentPassword, new_password: newPassword },
    });
  },
};
