import { createClient } from "npm:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  const { data: flag } = await admin.from("integration_settings").select("enabled").eq("key", "push_notifications").maybeSingle();
  if (!flag?.enabled) return json({ ok: true, enabled: false, status: "disabled" });

  const client = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("authorization") || "" } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) return json({ ok: false, error: "unauthorized" }, 401);

  const body = await req.json().catch(() => null);
  const subscription = body?.subscription;
  const hotel = String(body?.hotel_id || "").trim();
  const action = String(body?.action || "subscribe").trim();
  if (!hotel || !subscription?.endpoint) return json({ ok: false, error: "invalid_payload" }, 400);

  const { data: membership } = await admin.from("hotel_memberships").select("active").eq("auth_user_id", userData.user.id).eq("hotel_id", hotel).maybeSingle();
  if (!membership?.active) return json({ ok: false, error: "forbidden" }, 403);

  if (action === "status") {
    const { data: row } = await admin.from("push_subscriptions").select("id").eq("hotel_id", hotel).eq("utente", userData.user.id).eq("endpoint", subscription.endpoint).maybeSingle();
    return json({ ok: true, enabled: true, subscribed: Boolean(row) });
  }

  if (action === "unsubscribe") {
    await admin.from("push_subscriptions").delete().eq("hotel_id", hotel).eq("utente", userData.user.id).eq("endpoint", subscription.endpoint);
    const { count } = await admin.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("endpoint", subscription.endpoint);
    return json({ ok: true, removed: true, unsubscribe_browser: (count || 0) === 0 });
  }

  if (!subscription?.keys?.p256dh || !subscription?.keys?.auth) return json({ ok: false, error: "invalid_payload" }, 400);

  await admin.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint).neq("utente", userData.user.id);

  const { error } = await admin.from("push_subscriptions").upsert({
    hotel_id: hotel,
    utente: userData.user.id,
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
    creato_il: new Date().toISOString(),
  }, { onConflict: "hotel_id,utente,endpoint" });
  if (error) return json({ ok: false, error: "subscribe_failed", detail: error.message }, 500);
  return json({ ok: true, enabled: true, subscribed: true });
});
