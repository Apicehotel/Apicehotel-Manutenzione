import { createClient } from "npm:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
});
const MAX_MS = (7 * 60 + 20) * 60 * 1000;
const ELIGIBLE = new Set(["manutentore", "Portiere Notturno", "admin"]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "Metodo non consentito" }, 405);
  try {
    const authHeader = req.headers.get("authorization") || "";
    const client = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData.user) return json({ ok: false, error: "Non autenticato" }, 401);

    const { data: profile } = await admin
      .from("profiles")
      .select("active,legacy_user_id")
      .eq("auth_user_id", userData.user.id)
      .maybeSingle();
    if (!profile?.active || !profile.legacy_user_id) return json({ ok: false, error: "Utente non disponibile" }, 404);

    const { data: row, error: rowError } = await admin
      .from("utenti")
      .select("id,nome,ruolo,in_struttura,in_struttura_dal,in_struttura_via,in_struttura_hotel_id")
      .eq("id", profile.legacy_user_id)
      .maybeSingle();
    if (rowError || !row) return json({ ok: false, error: "Presenza non disponibile" }, 404);

    let present = Boolean(row.in_struttura);
    let since = row.in_struttura_dal as string | null;
    let hotelId = row.in_struttura_hotel_id as string | null;
    if (present) {
      const sinceMs = since ? new Date(since).getTime() : 0;
      const expired = !sinceMs || !hotelId || Date.now() - sinceMs >= MAX_MS;
      if (expired) {
        await admin.from("utenti").update({ in_struttura: false, in_struttura_dal: null, in_struttura_via: null, in_struttura_hotel_id: null }).eq("id", row.id);
        present = false;
        since = null;
        hotelId = null;
      }
    }

    return json({
      ok: true,
      eligible: ELIGIBLE.has(row.ruolo),
      role: row.ruolo,
      name: row.nome,
      present,
      hotel_id: present ? hotelId : null,
      since,
      expires_at: present && since ? new Date(new Date(since).getTime() + MAX_MS).toISOString() : null,
    });
  } catch (error) {
    console.error("presence-status", error instanceof Error ? error.message : "unknown");
    return json({ ok: false, error: "Errore presenza" }, 500);
  }
});