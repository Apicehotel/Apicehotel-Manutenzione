import postgres from "npm:postgres@3.4.7";
import webpush from "npm:web-push@3.6.7";

// Postgres diretto (come pin-auth e sync-sensori-temperatura): dal 1 ottobre 2026 PostgREST
// risponde 401 alle chiamate REST delle Edge Function con la chiave service_role.
const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 2, connect_timeout: 5, idle_timeout: 10 });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const HOTEL_NAMES: Record<string, string> = { hotelgio: "Hotel Giò", chocohotel: "Chocohotel", brigantino: "Hotel Il Brigantino" };
const APP_URL = "https://apicehotel.vercel.app";
const PUSH_ROLES = ["admin", "manutentore", "Direzione", "Direttore Centro Congressi", "Portiere Notturno", "Reception"];

async function secret(key: string): Promise<string | null> {
  const rows = await sql`select value from public.edge_function_secrets where key = ${key} limit 1`;
  return rows[0]?.value ? String(rows[0].value) : null;
}
async function setting(key: string): Promise<any> {
  const rows = await sql`select enabled, config from public.integration_settings where key = ${key} limit 1`;
  return rows[0] ?? null;
}
async function logEvent(job: any, type: string, details: any = {}) {
  await sql`insert into public.richieste_urgenti_eventi (urgente_id, hotel_id, tipo, da_chi, dettagli)
    values (${job.urgent_id}, ${job.hotel_id}, ${type}, 'Sistema', ${sql.json({ step: job.step, channel: job.channel, ...details })})`;
}
async function mark(job: any, status: string, error: string | null = null) {
  await sql`update public.urgent_reminder_jobs set
      status = ${status}, last_error = ${error}, updated_at = now(),
      sent_at = case when ${status}::text = 'sent' then now() else sent_at end
    where id = ${job.id}`;
}
async function retry(job: any, error: string, delayMs = 30000) {
  const attempts = (job.attempts || 0) + 1;
  if (attempts >= 3) {
    await sql`update public.urgent_reminder_jobs set status = 'failed', attempts = ${attempts}, last_error = ${error}, updated_at = now() where id = ${job.id}`;
    return;
  }
  const next = new Date(Date.now() + delayMs).toISOString();
  await sql`update public.urgent_reminder_jobs set status = 'pending', attempts = ${attempts}, last_error = ${error},
      next_attempt_at = ${next}::timestamptz, updated_at = now() where id = ${job.id}`;
}

async function pushFallback(job: any, urgent: any, title: string, message: string) {
  const flag = await setting("push_notifications");
  if (!flag?.enabled) return 0;
  const members = await sql`select auth_user_id from public.hotel_memberships
    where hotel_id = ${job.hotel_id} and active = true and role::text = any(${PUSH_ROLES}::text[])`;
  const ids = [...new Set(members.map((r: any) => String(r.auth_user_id || "")).filter(Boolean))];
  if (!ids.length) return 0;
  const subs = await sql`select id, endpoint, p256dh, auth, utente from public.push_subscriptions
    where hotel_id = ${job.hotel_id} and utente::text = any(${ids}::text[])`;
  if (!subs.length) return 0;
  const unique = [...new Map(subs.map((s: any) => [s.endpoint, s])).values()] as any[];
  const secrets = await sql`select key, value from public.edge_function_secrets where key in ('vapid_public','vapid_private','vapid_subject')`;
  const sm = new Map(secrets.map((r: any) => [r.key, r.value]));
  const pub = sm.get("vapid_public"), priv = sm.get("vapid_private"), subject = sm.get("vapid_subject") || "mailto:appmanutenzioneapice@gmail.com";
  if (!pub || !priv) return 0;
  webpush.setVapidDetails(subject, pub, priv);
  const target = `/?notification=urgent&hotel_id=${encodeURIComponent(job.hotel_id)}&urgent_id=${encodeURIComponent(job.urgent_id)}`;
  const payload = JSON.stringify({ title, body: message, tag: `avviso-urgente-${job.urgent_id}-r${job.step}`, url: target, urgent: true, eventType: "urgent", urgentId: job.urgent_id, hotelId: job.hotel_id, severity: urgent.gravita === "emergenza" ? "emergenza" : "urgente" });
  let sent = 0;
  const expired: string[] = [];
  await Promise.all(unique.map(async (s: any) => {
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload); sent++; }
    catch (e: any) { if (e?.statusCode === 404 || e?.statusCode === 410) expired.push(s.id); }
  }));
  if (expired.length) await sql`delete from public.push_subscriptions where id::text = any(${expired}::text[])`;
  if (sent > 0) {
    await sql`insert into public.notification_outbox (channel, hotel_id, subject, body, status, sent_at, metadata)
      values ('push', ${job.hotel_id}, ${title}, ${message}, 'sent', now(),
        ${sql.json({ event_type: "urgent_reminder", urgent_id: job.urgent_id, step: job.step, fallback_from: "ntfy" })})`;
  }
  return sent;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
  try {
    const expected = await secret("urgent_reminder_cron_secret");
    if (!expected || req.headers.get("x-cron-secret") !== expected) return json({ ok: false, error: "forbidden" }, 403);
    const jobs = await sql`select * from public.urgent_reminder_jobs where status = 'pending' and next_attempt_at <= now() order by next_attempt_at asc limit 50`;
    const ntfySetting = await setting("ntfy_alerts");
    const waSetting = await setting("urgent_whatsapp");
    const sid = await secret("twilio_account_sid"), token = await secret("twilio_auth_token"), waFrom = await secret("twilio_whatsapp_from");
    let sent = 0, cancelled = 0, blocked = 0, failed = 0, fallbackSent = 0;
    for (const job of jobs) {
      const urgentRows = await sql`select id, hotel_id, nota, gravita, posizione, reparto, stato from public.richieste_urgenti
        where id = ${job.urgent_id} and hotel_id = ${job.hotel_id} limit 1`;
      const urgent = urgentRows[0];
      if (!urgent || urgent.stato !== "aperta") { await mark(job, "cancelled"); cancelled++; continue; }
      await sql`update public.urgent_reminder_jobs set status = 'processing', updated_at = now() where id = ${job.id} and status = 'pending'`;
      const hotelName = HOTEL_NAMES[job.hotel_id] || job.hotel_id;
      const severity = urgent.gravita === "emergenza" ? "EMERGENZA" : "URGENTE";
      const body = [urgent.posizione, urgent.reparto, urgent.nota].filter(Boolean).join(" · ");
      const title = `${severity} · ${hotelName}`;
      const message = body || "Avviso urgente ancora senza presa in carico";
      try {
        if (job.channel === "ntfy") {
          const server = String(ntfySetting?.config?.server || "https://ntfy.sh").replace(/\/$/, "");
          const topic = String(ntfySetting?.config?.topics?.[job.hotel_id] || "");
          if (!ntfySetting?.enabled || !topic) { await mark(job, "blocked", "ntfy_not_configured"); blocked++; continue; }
          const click = `${APP_URL}/?notification=urgent&hotel_id=${encodeURIComponent(job.hotel_id)}&urgent_id=${encodeURIComponent(job.urgent_id)}`;
          const res = await fetch(server, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic, title, message, priority:5, tags:["rotating_light","warning"], click }) });
          if (!res.ok) {
            if (res.status === 429) {
              const delivered = await pushFallback(job, urgent, title, message);
              if (delivered > 0) { await mark(job, "sent", "ntfy_429_push_fallback"); await logEvent(job, "reminder_push_fallback", { reason: "ntfy_429", delivered }); sent++; fallbackSent += delivered; continue; }
              const retryAfter = Number(res.headers.get("retry-after") || 0);
              await retry(job, "ntfy_429", retryAfter > 0 ? retryAfter * 1000 : 60000); failed++; continue;
            }
            throw new Error(`ntfy_${res.status}`);
          }
          await mark(job, "sent"); await logEvent(job, "reminder_ntfy", { priority:5, click }); sent++; continue;
        }
        if (job.channel === "whatsapp") {
          const recipients = waSetting?.config?.recipients?.[job.hotel_id];
          if (!waSetting?.enabled || !sid || !token || !waFrom || !Array.isArray(recipients) || !recipients.length) {
            await mark(job, "blocked", "whatsapp_not_configured"); await logEvent(job, "reminder_whatsapp_non_inviato", { reason: "not_configured" }); blocked++; continue;
          }
          const auth = "Basic " + btoa(`${sid}:${token}`);
          let delivered = 0;
          for (const raw of recipients) {
            const to = String(raw).startsWith("whatsapp:") ? String(raw) : `whatsapp:${raw}`;
            const params = new URLSearchParams({ From: String(waFrom).startsWith("whatsapp:") ? String(waFrom) : `whatsapp:${waFrom}`, To: to, Body: `${severity} ${hotelName}: ${body || "avviso urgente senza presa in carico"}. Apri RandApp.` });
            const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, { method: "POST", headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" }, body: params });
            if (res.ok) delivered++; else throw new Error(`twilio_${res.status}`);
          }
          await mark(job, "sent"); await logEvent(job, "reminder_whatsapp", { delivered }); sent++; continue;
        }
      } catch (e) { failed++; await retry(job, e instanceof Error ? e.message : "delivery_failed"); }
    }
    return json({ ok: true, processed: jobs.length, sent, cancelled, blocked, failed, fallbackSent });
  } catch (e) {
    console.error("urgent-reminder-worker failed", e instanceof Error ? e.message : "unknown");
    return json({ ok: false, error: "temporary_error" }, 500);
  }
});
