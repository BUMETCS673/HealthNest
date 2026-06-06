import { authApi } from "./authApi";

/**
 * AI-USAGE SUMMARY
 * Tools: Opus 4.7
 * Overall AI Contribution: ~65%
 * AI-Assisted Areas: Wrote the jsonRequest / multipartRequest fetch wrappers including the FastAPI detail-array vs string error normalization.
 * Human Contributions: Method-level API surface (list/get/upload/patch/release/archive/fileUrl), token-pulling strategy that matches the existing authApi session shape, and the decision to keep source_format optional on upload for backwards compatibility.
 */
const API_URL =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:8000";
async function jsonRequest(path, { method = "GET", body } = {}, retry = true) {
  const t = await authApi.getValidAccessToken();
  const headers = { "Content-Type": "application/json" };
  if (t) headers.Authorization = `Bearer ${t}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && retry) {
    const refreshed = await authApi.refreshSession();
    if (refreshed) return jsonRequest(path, { method, body }, false);
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

async function multipartRequest(path, formData, retry = true) {
  const t = await authApi.getValidAccessToken();
  const headers = {};
  if (t) headers.Authorization = `Bearer ${t}`;

  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (res.status === 401 && retry) {
    const refreshed = await authApi.refreshSession();
    if (refreshed) return multipartRequest(path, formData, false);
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
    return jsonRequest(`/lab-results/${id}`, {
      method: "PATCH",
      body: payload,
    });
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
