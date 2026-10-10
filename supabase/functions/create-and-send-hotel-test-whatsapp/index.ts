import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const clean = (value: unknown, max = 500) => String(value ?? "").trim().slice(0, max);
const HOTEL_NAMES: Record<string, string> = { hotelgio: "Hotel Giò", chocohotel: "ChocoHotel", brigantino: "Bricantino" };
const HOTEL_IDS = Object.keys(HOTEL_NAMES);
const TEST_CONTENT_SID = "HX02e74abd4bfd7db4c4ef5b195946f983";

function e164(value: unknown) {
  const raw = clean(value, 40).replace(/[^\d+]/g, "");
  if (raw.startsWith("+")) return raw;
  if (raw.startsWith("39")) return `+${raw}`;
  return `+39${raw.replace(/^0+/, "")}`;
}

async function actor(req: Request) {
  const client = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: req.headers.get("authorization") || "" } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.getUser();
  return error || !data.user ? null : data.user;
}

async function sendTemplate(accountSid: string, authToken: string, from: string, to: string, variables: Record<string, string>) {
  const form = new URLSearchParams({ From: `whatsapp:${from}`, To: `whatsapp:${to}`, ContentSid: TEST_CONTENT_SID, ContentVariables: JSON.stringify(variables) });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}` }, body: form.toString() });
  const body = await response.json().catch(() => null);
  return { ok: response.ok, sid: body?.sid || null, status: body?.status || null, error: body?.message || body?.error_message || null };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
  try {
    const user = await actor(req);
    if (!user) return json({ ok: false, error: "authentication_required" }, 401);
    const body = await req.json().catch(() => ({}));
    if (body?.confirm_test !== true) return json({ ok: false, error: "confirm_test_required" }, 400);
    // Recipient must be explicit — never default to a hard-coded personal number.
    if (!body?.recipient) return json({ ok: false, error: "recipient_required" }, 400);
    const recipient = e164(body.recipient);
    const hotels = Array.isArray(body.hotel_ids) && body.hotel_ids.length ? body.hotel_ids.map((id: unknown) => clean(id, 40)).filter((id: string) => HOTEL_IDS.includes(id)) : HOTEL_IDS;
    if (!/^\+[1-9]\d{7,14}$/.test(recipient) || !hotels.length) return json({ ok: false, error: "invalid_recipient_or_hotels" }, 400);

    const { data: memberships } = await admin.from("hotel_memberships").select("hotel_id,can_access_admin,active").eq("auth_user_id", user.id).in("hotel_id", hotels).eq("active", true);
    const allowed = new Set((memberships || []).filter((row: any) => row.can_access_admin === true).map((row: any) => row.hotel_id));
    if (hotels.some((hotelId: string) => !allowed.has(hotelId))) return json({ ok: false, error: "admin_access_required" }, 403);

    const [{ data: channels }, { data: secrets }] = await Promise.all([
      admin.from("whatsapp_channel_settings").select("hotel_id,inbound_number,receive_enabled").in("hotel_id", hotels),
      admin.from("edge_function_secrets").select("key,value").in("key", ["twilio_account_sid", "twilio_auth_token"]),
    ]);
    const channelMap = new Map((channels || []).map((row: any) => [row.hotel_id, row]));
    const secretMap = new Map((secrets || []).map((row: any) => [row.key, row.value]));
    if (!secretMap.get("twilio_account_sid") || !secretMap.get("twilio_auth_token")) return json({ ok: false, error: "twilio_not_configured" }, 503);

    const results = [];
    for (const hotelId of hotels) {
      const hotelName = HOTEL_NAMES[hotelId];
      const channel = channelMap.get(hotelId);
      if (!channel?.receive_enabled || !channel.inbound_number) { results.push({ hotel_id: hotelId, ok: false, error: "sender_not_configured" }); continue; }
      const note = `${hotelName} — Segnalazione di prova: perdita d'acqua in bagno.`;
      const { data: issue, error: issueError } = await admin.from("segnalazioni").insert({ hotel_id: hotelId, camera: "204", categoria: "Idraulico", urgenza: "media", note, creato_da: `Test WhatsApp ${user.id}`, stato: "todo", origine: "App" }).select("id").single();
      if (issueError || !issue) { results.push({ hotel_id: hotelId, ok: false, error: "issue_create_failed" }); continue; }
      const sent = await sendTemplate(String(secretMap.get("twilio_account_sid")), String(secretMap.get("twilio_auth_token")), e164(channel.inbound_number), recipient, { "1": "Idraulico", "2": "204", "3": note });
      await admin.from("notification_outbox").insert({ channel: "whatsapp", hotel_id: hotelId, recipient, subject: `Nuova segnalazione · ${hotelName}`, body: note, status: sent.ok ? "sent" : "failed", sent_at: sent.ok ? new Date().toISOString() : null, error: sent.error, metadata: { event_type: "test_issue_created", issue_id: issue.id, twilio_sid: sent.sid, content_sid: TEST_CONTENT_SID } });
      results.push({ hotel_id: hotelId, issue_id: issue.id, ok: sent.ok, sid: sent.sid, status: sent.status, error: sent.error });
    }
    return json({ ok: results.every((result) => result.ok), recipient, results });
  } catch (error) {
    console.error("create-and-send-hotel-test-whatsapp", error instanceof Error ? error.message : "unknown");
    return json({ ok: false, error: "temporary_error" }, 500);
  }
});
