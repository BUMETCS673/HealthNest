/**
 * AI-USAGE SUMMARY
 * Tools: Claude Code (Opus 4.8)
 * Overall AI Contribution: ~80%
 * AI-Assisted Areas: Provider scheduling API client (availability list/add/
 *   delete, patients, appointments list, provider-initiated booking) over the
 *   shared 401-refresh-and-retry request wrapper.
 * Human Contributions: Verified the endpoint surface against the backend.
 * Notes: Validated via `npm run build` and jest.
 */
import { authApi } from "./authApi";

const BASE =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:8000";

async function request(path, options = {}, retry = true) {
  const token = await authApi.getValidAccessToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401 && retry) {
    const refreshed = await authApi.refreshSession();
    if (refreshed) return request(path, options, false);
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const detail =
      typeof data.detail === "string"
        ? data.detail
        : data.detail?.[0]?.msg || res.statusText;
    throw new Error(detail);
  }
  return res.status === 204 ? null : res.json();
}

export const schedulingApi = {
  getAvailability: () => request("/schedule/availability"),
  addAvailability: (body) =>
    request("/schedule/availability", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteAvailability: (id) =>
    request(`/schedule/availability/${id}`, { method: "DELETE" }),
  setSlot: (body) =>
    request("/schedule/slot", { method: "POST", body: JSON.stringify(body) }),
  getRules: () => request("/schedule/rules"),
  addRule: (body) =>
    request("/schedule/rules", { method: "POST", body: JSON.stringify(body) }),
  deleteRule: (id) => request(`/schedule/rules/${id}`, { method: "DELETE" }),
  getPatients: () => request("/schedule/patients"),
  getAppointments: () => request("/schedule/appointments"),
  createAppointment: (body) =>
    request("/schedule/appointments", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  cancelAppointment: (id) =>
    request(`/schedule/appointments/${id}/cancel`, { method: "POST" }),
};
