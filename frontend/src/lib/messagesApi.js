const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

function authHeaders() {
  const session = JSON.parse(
    localStorage.getItem("sb-tuujofmwfricjqdhqnsd-auth-token") ?? "{}",
  );
  const token = session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.status === 204 ? null : res.json();
}

export const messagesApi = {
  getInbox: () => request("/messages/inbox"),
  sendMessage: (recipientId, body) =>
    request("/messages/", {
      method: "POST",
      body: JSON.stringify({ recipient_id: recipientId, body }),
    }),
};
