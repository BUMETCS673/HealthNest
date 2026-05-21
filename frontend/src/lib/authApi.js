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
};
