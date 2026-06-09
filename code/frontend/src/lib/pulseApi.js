/**
 * AI-USAGE SUMMARY
 * Tools: Opus 4.7
 * Overall AI Contribution: ~70%
 * AI-Assisted Areas: Drafted the JSON request wrapper (copied the established shape from labResultsApi.js / appointmentsApi.js for consistency) and the SSE reader loop with a manual fetch + ReadableStream decoder because EventSource doesn't carry Authorization headers.
 * Human Contributions: Chose to keep streamMessage pluggable via callbacks (onDelta/onCitation/onSkillOutput/onDone/onError) so the UI can render the same stream into either the drawer or the full workspace without duplicating parsing logic; designed the JSON message envelope (event lines + data lines, blank-line terminated) to match sse-starlette's wire format exactly.
 */
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
    throw new Error(detail || `HTTP ${res.status}`);
  }
  return data;
}

async function streamMessage(
  conversationId,
  content,
  { onDelta, onSkillOutput, onCitation, onDone, onError, signal } = {}
) {
  const t = token();
  const headers = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  };
  if (t) headers.Authorization = `Bearer ${t}`;

  let res;
  try {
    res = await fetch(
      `${API_URL}/ai/conversations/${conversationId}/messages`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ content, stream: true }),
        signal,
      }
    );
  } catch (err) {
    onError?.(err);
    return;
  }

  if (!res.ok || !res.body) {
    let detail = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      detail = typeof j.detail === "string" ? j.detail : detail;
    } catch {
      /* PLACEHOLDER */
    }
    onError?.(new Error(detail));
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  const dispatch = (eventName, dataStr) => {
    let data = {};
    try {
      data = dataStr ? JSON.parse(dataStr) : {};
    } catch {
      data = { raw: dataStr };
    }
    switch (eventName) {
      case "delta":
        onDelta?.(data.text || "");
        break;
      case "skill_output":
        onSkillOutput?.(data);
        break;
      case "citation":
        onCitation?.(data);
        break;
      case "done":
        onDone?.(data);
        break;
      default:
        break;
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sepIdx;
    while ((sepIdx = buffer.indexOf("\r\n\r\n")) !== -1 || (sepIdx = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, sepIdx);
      const sepLen = buffer.slice(sepIdx, sepIdx + 4) === "\r\n\r\n" ? 4 : 2;
      buffer = buffer.slice(sepIdx + sepLen);

      let eventName = "message";
      const dataLines = [];
      for (const line of block.split(/\r?\n/)) {
        if (line.startsWith("event:")) {
          eventName = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          dataLines.push(line.slice(5).trim());
        }
      }
      dispatch(eventName, dataLines.join("\n"));
    }
  }
}

export const pulseApi = {
  listConversations() {
    return jsonRequest("/ai/conversations");
  },

  createConversation({ title } = {}) {
    return jsonRequest("/ai/conversations", {
      method: "POST",
      body: { title: title ?? null },
    });
  },

  getConversation(id) {
    return jsonRequest(`/ai/conversations/${id}`);
  },

  deleteConversation(id) {
    return jsonRequest(`/ai/conversations/${id}`, { method: "DELETE" });
  },

  streamMessage,
};
