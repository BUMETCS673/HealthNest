import { createClient } from "@supabase/supabase-js";

const API_URL =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:8000";

// The Supabase URL + anon key are public, but the team keeps them in the
// backend's docker-compose environment rather than a frontend .env. So the
// browser fetches them at runtime from a public backend endpoint and builds
// the Realtime client once (memoized). Nothing is created at import time, so
// importing this module is always safe (e.g. in unit tests).
let clientPromise = null;

async function loadConfig() {
  const res = await fetch(`${API_URL}/config`);
  if (!res.ok) throw new Error("Failed to load Supabase config");
  return res.json(); // { supabase_url, supabase_anon_key }
}

export function getSupabaseClient() {
  if (!clientPromise) {
    clientPromise = (async () => {
      const cfg = await loadConfig();
      return createClient(cfg.supabase_url, cfg.supabase_anon_key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    })();
  }
  return clientPromise;
}

export async function setRealtimeAuth(accessToken) {
  const client = await getSupabaseClient();
  client.realtime.setAuth(accessToken ?? null);
}
