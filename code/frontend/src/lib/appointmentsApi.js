const API_URL =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:8000";

function getToken() {
  try {
    const raw = localStorage.getItem("healthnest.session");
    return raw ? JSON.parse(raw)?.access_token : null;
  } catch {
    return null;
  }
}

async function request(path, { method = "GET", body } = {}) {
  const token = getToken();
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

export const appointmentsApi = {
  /** Fetch all appointments for the signed-in patient. */
  getAppointments() {
    return request("/appointments/");
  },

  /** Book a new appointment. */
  createAppointment(data) {
    return request("/appointments/", { method: "POST", body: data });
  },

  /** Reschedule or update an appointment. */
  updateAppointment(id, data) {
    return request(`/appointments/${id}`, { method: "PATCH", body: data });
  },

  /** Soft-cancel an appointment. */
  cancelAppointment(id) {
    return request(`/appointments/${id}`, { method: "DELETE" });
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
  const d = new Date(appt.appointment_date + "T12:00:00");
  return {
    id: appt.id,
    month: d.toLocaleDateString("en-US", { month: "short" }),
    day: String(d.getDate()),
    doctor: appt.provider_name,
    specialty: appt.specialty || "",
    date: d.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
    time: formatApptTime(appt.appointment_time),
    address: appt.location || "",
    status: appt.status,
    raw: appt,
  };
}
