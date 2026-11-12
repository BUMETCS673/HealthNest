/**
 * AI-USAGE SUMMARY
 * Tools: Claude Code (Opus 4.8)
 * Overall AI Contribution: ~50%
 * AI-Assisted Areas: The messaging API client (contacts, thread, mark-read,
 *   inbox, unread counts, send) and the 401-refresh-and-retry wrapper.
 * Human Contributions: Fixed the session-token storage key; verified against the
 *   backend routes.
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

export const messagesApi = {
  getContacts: () => request("/messages/contacts"),
  getThread: (contactId) => request(`/messages/thread/${contactId}`),
  markThreadRead: (contactId) =>
    request(`/messages/thread/${contactId}/read`, { method: "PATCH" }),
  getInbox: () => request("/messages/inbox"),
  getUnreadCounts: () => request("/messages/unread"),
  sendMessage: (recipientId, body) =>
    request("/messages/", {
      method: "POST",
      body: JSON.stringify({ recipient_id: recipientId, body }),
    }),
};
