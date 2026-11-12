import { authApi } from "./authApi";

/**
 * AI-USAGE SUMMARY
 * Tools: Opus 4.7
 * Overall AI Contribution: ~65%
 * AI-Assisted Areas: Wrote the request wrapper, the Map-based id cache, and the getMany batched-fetch helper.
 * Human Contributions: Caching strategy (per-session, no TTL), the name-formatter rules (preferred_name vs first_name precedence, MRN + DOB subtitle), and the decision to swallow individual lookup failures inside getMany rather than fail the whole batch.
 */
const API_URL =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:8000";
async function request(path, retry = true) {
  const t = await authApi.getValidAccessToken();
  const headers = {};
  if (t) headers.Authorization = `Bearer ${t}`;
  const res = await fetch(`${API_URL}${path}`, { headers });

  if (res.status === 401 && retry) {
    const refreshed = await authApi.refreshSession();
    if (refreshed) return request(path, false);
  }

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
