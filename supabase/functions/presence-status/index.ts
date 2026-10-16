import postgres from "npm:postgres@3.4.7";
import { handlePresence } from "./handler.js";

// Use the same database/Auth path as pin-auth. An internal PostgREST 401 must
// never be mistaken for an inactive or missing operational profile.
const url = Deno.env.get("SUPABASE_URL")!;
const rawKeys = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
const keys = rawKeys ? JSON.parse(rawKeys) : {};
const publicKey = String(keys.default || Object.values(keys)[0] || Deno.env.get("SUPABASE_ANON_KEY") || "");
const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, {
  prepare: false, max: 2, connect_timeout: 5, idle_timeout: 10,
});

Deno.serve((req: Request) => handlePresence(req, {
  sql,
  authenticate: async (authorization: string) => {
    const response = await fetch(`${url}/auth/v1/user`, {
      signal: AbortSignal.timeout(10000),
      headers: { apikey: publicKey, Authorization: authorization, Accept: "application/json" },
    });
    if (response.status === 401 || response.status === 403) return null;
    if (!response.ok) throw new Error("AUTH_UNAVAILABLE");
    const user = await response.json();
    return user?.id || null;
  },
}));
