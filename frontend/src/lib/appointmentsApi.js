/**
 * AI-USAGE SUMMARY
 * Tools: Claude Code (Opus 4.8)
 * Overall AI Contribution: ~65%
 * AI-Assisted Areas: Endpoint methods for the new appointment contract,
 *   apptToDisplayRow mapping to the nested schema, and the 401-refresh-and-retry
 *   wrapper.
 * Human Contributions: Verified the API surface against the backend; reviewed
 *   and tested.
 * Notes: Validated via `npm run build` and the jest suite.
 */
import { authApi } from "./authApi";

const API_URL =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:8000";

async function request(path, { method = "GET", body } = {}, retry = true) {
  const token = await authApi.getValidAccessToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // token expired/invalid → refresh once, then replay the request
  if (res.status === 401 && retry) {
    const refreshed = await authApi.refreshSession();
    if (refreshed) return request(path, { method, body }, false);
  }

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

export const appointmentsApi = {
  /** Fetch all appointments for the signed-in patient. */
  getAppointments() {
    return request("/appointments/");
  },

  /** Book a new appointment. */
  createAppointment(data) {
    return request("/appointments/", { method: "POST", body: data });
  },

  /** Edit appointment notes. */
  editAppointmentNotes(id, notes) {
    return request(`/appointments/${id}/edit_notes`, {
      method: "PATCH",
      body: { notes },
    });
  },

  /** Reschedule an appointment. */
  rescheduleAppointment(id, data) {
    return request(`/appointments/${id}/reschedule`, {
      method: "POST",
      body: data,
    });
  },

  /** Soft-cancel an appointment. */
  cancelAppointment(id) {
    return request(`/appointments/${id}/cancel`, { method: "POST" });
  },

  /** List unbooked provider slots. */
  getAvailability() {
    return request("/appointments/availability");
  },
};

export const providersApi = {
  /** Fetch all providers. */
  getProviders() {
    return request("/providers/");
  },

  /** Fetch the signed-in patient's active care-team providers. */
  getCareTeam() {
    return request("/providers/care-team");
  },
};

// ── Date / time helpers shared across components ──────────────

export function formatApptDate(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "long",
    day: "numeric",
  });
}

export function formatApptTime(timeStr) {
  if (!timeStr) return "";
  const [hours, minutes] = timeStr.split(":");
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${minutes} ${ampm}`;
}

export function apptToDisplayRow(appt) {
  const dateStr = appt.provider_availability?.available_date;
  const d = dateStr ? new Date(`${dateStr}T12:00:00`) : null;
  return {
    id: appt.id,
    month: d ? d.toLocaleDateString("en-US", { month: "short" }) : "",
    day: d ? String(d.getDate()) : "",
    doctor: appt.providers
      ? `${appt.providers.first_name} ${appt.providers.last_name}`
      : "Unknown provider",
    specialty: appt.providers?.specialty || "",
    date: d
      ? d.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : "",
    time: formatApptTime(appt.provider_availability?.available_time),
    status: appt.status,
    raw: appt,
  };
}
