/**
 * AI-USAGE SUMMARY
 * Tools: Claude Code (Opus 4.8)
 * Overall AI Contribution: ~60%
 * AI-Assisted Areas: Lazy, memoized Supabase browser client that fetches its
 *   public url + anon key from the backend /config endpoint at runtime, plus
 *   the setRealtimeAuth helper.
 * Human Contributions: Decided to source config from the backend environment
 *   (docker-compose) rather than a frontend .env so no Supabase keys ship in the
 *   client bundle; chose lazy init so importing the module never builds a client
 *   (keeps unit tests from crashing).
 * Notes: Validated via `npm run build`, the jest suite, and manual Realtime testing.
 */
import { createClient } from "@supabase/supabase-js";

const API_URL =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:8000";

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
