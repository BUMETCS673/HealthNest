/**
 * AI-USAGE SUMMARY
 * Tools: Claude Code (Opus 4.8)
 * Overall AI Contribution: ~90%
 * AI-Assisted Areas: Notification feed API client (#SCRUM-76) with the shared
 *   401-refresh-and-retry wrapper.
 * Human Contributions: Verified against the backend route.
 * Notes: Validated via `npm run build` and manual testing.
 */
import { authApi } from "./authApi";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

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

  if (!res.ok) throw new Error(await res.text());
  return res.status === 204 ? null : res.json();
}

export const notificationsApi = {
  getNotifications: () => request("/notifications/"),
};
