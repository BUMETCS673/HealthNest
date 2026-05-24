const API_URL =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:8000";
const SESSION_STORAGE_KEY = "healthnest.session";

function token() {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw)?.access_token ?? null : null;
  } catch {
    return null;
  }
}

async function request(path) {
  const headers = {};
  const t = token();
  if (t) headers.Authorization = `Bearer ${t}`;
  const res = await fetch(`${API_URL}${path}`, { headers });
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

const cache = new Map();

export const patientsApi = {
  search({ q, limit = 20 } = {}) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("limit", String(limit));
    return request(`/patients?${params.toString()}`);
  },

  async get(id) {
    if (cache.has(id)) return cache.get(id);
    const p = await request(`/patients/${id}`);
    cache.set(id, p);
    return p;
  },

  async getMany(ids) {
    const out = {};
    const missing = [];
    for (const id of ids) {
      if (cache.has(id)) out[id] = cache.get(id);
      else missing.push(id);
    }
    await Promise.all(
      missing.map((id) =>
        request(`/patients/${id}`)
          .then((p) => {
            cache.set(id, p);
            out[id] = p;
          })
          .catch(() => {
          })
      )
    );
    return out;
  },

  clearCache() {
    cache.clear();
  },
};

export function formatPatientName(p) {
  if (!p) return "Unknown patient";
  const preferred = (p.preferred_name || "").trim();
  const last = (p.last_name || "").trim();
  const first = (p.first_name || "").trim();
  if (preferred && last) return `${preferred} ${last}`;
  return [first, last].filter(Boolean).join(" ") || "Unknown patient";
}

export function formatPatientSubtitle(p) {
  if (!p) return "";
  const parts = [];
  if (p.mrn) parts.push(`MRN ${p.mrn}`);
  if (p.date_of_birth) {
    const d = new Date(p.date_of_birth);
    if (!isNaN(d)) {
      parts.push(
        `DOB ${d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}`
      );
    }
  }
  return parts.join(" · ");
}
