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

async function jsonRequest(path, { method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  const t = token();
  if (t) headers.Authorization = `Bearer ${t}`;

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

async function multipartRequest(path, formData) {
  const headers = {};
  const t = token();
  if (t) headers.Authorization = `Bearer ${t}`;

  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers,
    body: formData,
  });

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

export const labResultsApi = {
  list({ patientId, statusFilter, limit = 50, offset = 0 } = {}) {
    const params = new URLSearchParams();
    if (patientId) params.set("patient_id", patientId);
    if (statusFilter) params.set("status_filter", statusFilter);
    params.set("limit", String(limit));
    params.set("offset", String(offset));
    return jsonRequest(`/lab-results?${params.toString()}`);
  },

  get(id) {
    return jsonRequest(`/lab-results/${id}`);
  },

  upload({ file, patientId, sourceFormat, diagnosticOrderId }) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("patient_id", patientId);
    if (sourceFormat) fd.append("source_format", sourceFormat);
    if (diagnosticOrderId) fd.append("diagnostic_order_id", diagnosticOrderId);
    return multipartRequest("/lab-results", fd);
  },

  patch(id, payload) {
    return jsonRequest(`/lab-results/${id}`, { method: "PATCH", body: payload });
  },

  release(id) {
    return jsonRequest(`/lab-results/${id}/release`, { method: "POST" });
  },

  archive(id) {
    return jsonRequest(`/lab-results/${id}/archive`, { method: "POST" });
  },

  fileUrl(id) {
    return jsonRequest(`/lab-results/${id}/file`);
  },
};
