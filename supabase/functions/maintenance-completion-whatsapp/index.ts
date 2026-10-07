import { createClient } from "npm:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const HOTEL_NAMES: Record<string, string> = { hotelgio: "Hotel Giò", chocohotel: "Chocohotel", brigantino: "Hotel Il Brigantino" };
const EVENT = "maintenance_completed";
const clean = (value: unknown, max = 500) => String(value ?? "").trim().slice(0, max);
function e164(value: unknown) { const raw = clean(value, 40).replace(/[^\d+]/g, ""); if (/^\+[1-9]\d{7,14}$/.test(raw)) return raw; if (/^39\d{8,14}$/.test(raw)) return `+${raw}`; return null; }

async function sendTemplate(accountSid: string, authToken: string, from: string, to: string, contentSid: string, variables: Record<string, string>) {
  const form = new URLSearchParams({ From: `whatsapp:${from}`, To: `whatsapp:${to}`, ContentSid: contentSid, ContentVariables: JSON.stringify(variables) });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}` }, body: form.toString() });
  const data = await response.json().catch(() => null);
  return { ok: response.ok, sid: data?.sid || null, status: data?.status || null, error: data?.message || data?.error_message || String(data?.error_code || response.status) };
}

async function actor(req: Request, hotelId: string) {
  const client = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("authorization") || "" } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return false;
  const { data: membership } = await admin.from("hotel_memberships").select("active").eq("auth_user_id", data.user.id).eq("hotel_id", hotelId).maybeSingle();
  return Boolean(membership?.active);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const issueId = clean(body?.issue_id || body?.issueId, 120);
    const hotelId = clean(body?.hotel_id || body?.hotelId, 80);
    if (!issueId || !hotelId) return json({ ok: false, error: "issue_id_and_hotel_id_required" }, 400);
    if (!await actor(req, hotelId)) return json({ ok: false, error: "forbidden" }, 403);
    const [{ data: issue }, { data: setting }, { data: channel }, { data: secrets }] = await Promise.all([
      admin.from("segnalazioni").select("id,hotel_id,camera,categoria,note,nota_completamento,completato_da,completato_il,stato").eq("id", issueId).eq("hotel_id", hotelId).maybeSingle(),
      admin.from("integration_settings").select("enabled,config").eq("key", "twilio_whatsapp").maybeSingle(),
      admin.from("whatsapp_channel_settings").select("inbound_number").eq("hotel_id", hotelId).maybeSingle(),
      admin.from("edge_function_secrets").select("key,value").in("key", ["twilio_account_sid", "twilio_auth_token"]),
    ]);
    if (!issue || issue.stato !== "done") return json({ ok: false, error: "maintenance_not_completed" }, 409);
    if (!setting?.enabled) return json({ ok: true, status: "disabled", sent: 0 });
    const contentSid = clean(setting.config?.completion_content_sid, 100);
    const from = e164(channel?.inbound_number);
    const secretMap = new Map((secrets || []).map((row: any) => [row.key, row.value]));
    if (!contentSid || !from || !secretMap.get("twilio_account_sid") || !secretMap.get("twilio_auth_token")) return json({ ok: false, error: "twilio_completion_not_configured" }, 503);
    const { data: memberships } = await admin.from("hotel_memberships").select("auth_user_id").eq("hotel_id", hotelId).eq("active", true).eq("role", "Reception");
    const ids = [...new Set((memberships || []).map((row: any) => row.auth_user_id).filter(Boolean))];
    const { data: profiles } = ids.length ? await admin.from("profiles").select("auth_user_id,display_name,phone").in("auth_user_id", ids).eq("active", true) : { data: [] as any[] };
    const recipients = (profiles || []).map((profile: any) => ({ ...profile, phone: e164(profile.phone) })).filter((profile: any) => profile.phone);
    if (!recipients.length) return json({ ok: true, status: "no_reception_phone", sent: 0 });
    const hotelName = HOTEL_NAMES[hotelId] || hotelId;
    const bodyText = `Manutenzione completata · ${hotelName} · ${clean(issue.camera, 80)} · ${clean(issue.categoria, 100)}${issue.nota_completamento ? ` · ${clean(issue.nota_completamento, 260)}` : ""}`;
    let sent = 0;
    for (const recipient of recipients) {
      const metadata = { event_type: EVENT, issue_id: issueId, recipient_auth_user_id: recipient.auth_user_id };
      const { data: existing } = await admin.from("notification_outbox").select("id,status").eq("channel", "whatsapp").eq("hotel_id", hotelId).eq("recipient", recipient.phone).contains("metadata", { event_type: EVENT, issue_id: issueId }).maybeSingle();
      if (existing?.status === "sent") continue;
      const result = await sendTemplate(String(secretMap.get("twilio_account_sid")), String(secretMap.get("twilio_auth_token")), from, recipient.phone, contentSid, { "1": hotelName, "2": clean(issue.camera, 80), "3": clean(issue.categoria, 100), "4": clean(issue.nota_completamento || issue.note, 260), "5": clean(issue.completato_da, 120) });
      const patch = { status: result.ok ? "sent" : "failed", sent_at: result.ok ? new Date().toISOString() : null, error: result.ok ? null : result.error, metadata: { ...metadata, twilio_sid: result.sid, twilio_status: result.status } };
      if (existing) await admin.from("notification_outbox").update(patch).eq("id", existing.id);
      else await admin.from("notification_outbox").insert({ channel: "whatsapp", hotel_id: hotelId, recipient: recipient.phone, subject: "Manutenzione completata", body: bodyText, ...patch });
      if (result.ok) sent += 1;
    }
    return json({ ok: true, status: "sent", sent, targeted: recipients.length });
  } catch (error) { console.error("maintenance-completion-whatsapp", error instanceof Error ? error.message : "unknown"); return json({ ok: false, error: "send_failed" }, 500); }
});
