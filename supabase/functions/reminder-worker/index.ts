import postgres from "npm:postgres@3.4.7";

// Postgres diretto: dal 1 ottobre 2026 PostgREST risponde 401 alle chiamate REST
// delle Edge Function con la chiave service_role.
const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 2, connect_timeout: 5, idle_timeout: 10 });
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const HOTEL_NAMES: Record<string, string> = { hotelgio: "Hotel Giò", chocohotel: "Chocohotel", brigantino: "Hotel Il Brigantino" };
const APP_URL = "https://apicehotel.vercel.app";

async function secret(key: string): Promise<string | null> {
  const rows = await sql`select value from public.edge_function_secrets where key = ${key} limit 1`;
  return rows[0]?.value ? String(rows[0].value) : null;
}

// L'URL firmato passa dall'API Storage (non da PostgREST). Se fallisce il promemoria parte senza allegato.
async function signedPhotoUrl(path: string): Promise<string | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/maintenance-photos/${path.split("/").map(encodeURIComponent).join("/")}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: 3600 }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.signedURL ? `${SUPABASE_URL}/storage/v1${data.signedURL}` : null;
  } catch { return null; }
}

function localParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short" });
  const p: any = Object.fromEntries(fmt.formatToParts(date).filter((x) => x.type !== "literal").map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}`, weekday: String(p.weekday).slice(0, 3).toLowerCase() };
}

// Le colonne date arrivano da Postgres come Date: le riporto a stringa YYYY-MM-DD come faceva PostgREST.
const ymd = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : v ? String(v).slice(0, 10) : null);

function due(r: any, now: any) {
  if (!r.active) return false;
  if (r.start_date && now.date < r.start_date) return false;
  if (r.end_date && now.date > r.end_date) return false;
  if (!Array.isArray(r.times) || !r.times.includes(now.time)) return false;
  if (r.repeat_kind === "once") return now.date === r.start_date;
  if (r.repeat_kind === "daily") return true;
  if (r.repeat_kind === "weekly") return Array.isArray(r.weekdays) && r.weekdays.includes(now.weekday);
  if (r.repeat_kind === "monthly") return Number(now.date.slice(8, 10)) === Number(r.month_day || String(r.start_date || "").slice(8, 10));
  return false;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
  try {
    const expected = await secret("reminder_cron_secret");
    if (!expected || req.headers.get("x-cron-secret") !== expected) return json({ ok: false, error: "forbidden" }, 403);
    const now = localParts();
    const rows = (await sql`select * from public.promemoria where active = true`).map((r: any) => ({ ...r, start_date: ymd(r.start_date), end_date: ymd(r.end_date) }));
    const settingRows = await sql`select enabled, config from public.integration_settings where key = 'ntfy_alerts' limit 1`;
    const setting = settingRows[0];
    if (!setting?.enabled) return json({ ok: true, processed: 0, status: "ntfy_disabled" });
    const server = String(setting.config?.server || "https://ntfy.sh").replace(/\/$/, "");
    let sent = 0, skipped = 0, failed = 0;
    for (const r of rows) {
      if (!due(r, now)) { skipped++; continue; }
      const dedupe = `${r.id}:${now.date}:${now.time}`;
      const existing = await sql`select id from public.promemoria_invio where dedupe_key = ${dedupe} limit 1`;
      if (existing.length) { skipped++; continue; }
      const roles = Array.isArray(r.target_roles) ? r.target_roles : [];
      const roleTopics = setting.config?.role_topics?.[r.hotel_id] || {};
      const targets = [...new Set(roles.map((role: string) => String(roleTopics?.[role] || "")).filter(Boolean))] as string[];
      const scheduledFor = `${now.date}T${now.time}:00+02:00`;
      if (!targets.length) {
        await sql`insert into public.promemoria_invio (promemoria_id, hotel_id, dedupe_key, status, error, scheduled_for)
          values (${r.id}, ${r.hotel_id}, ${dedupe}, 'blocked', 'role_topic_not_configured', ${scheduledFor}::timestamptz)`;
        failed++; continue;
      }
      const signed = r.photo_path ? await signedPhotoUrl(String(r.photo_path)) : null;
      let ok = 0;
      for (const topic of targets) {
        const payload: any = { topic, title: `PROMEMORIA · ${HOTEL_NAMES[r.hotel_id] || r.hotel_id}`, message: String(r.message || "Promemoria RandApp").slice(0, 500), priority: 3, tags: ["bell", "memo"], click: `${APP_URL}/?notification=reminder&hotel_id=${encodeURIComponent(r.hotel_id)}&reminder_id=${encodeURIComponent(r.id)}` };
        if (signed) payload.attach = signed;
        const res = await fetch(server, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        if (res.ok) ok++;
      }
      await sql`insert into public.promemoria_invio (promemoria_id, hotel_id, dedupe_key, status, scheduled_for, sent_at, details)
        values (${r.id}, ${r.hotel_id}, ${dedupe}, ${ok === targets.length ? "sent" : "partial"}, ${scheduledFor}::timestamptz, now(),
          ${sql.json({ roles, topics: targets.length, priority: 3, photo: Boolean(signed) })})`;
      if (ok) sent++; else failed++;
    }
    return json({ ok: true, now, processed: rows.length, sent, skipped, failed });
  } catch (e) {
    console.error("reminder-worker failed", e instanceof Error ? e.message : "unknown");
    return json({ ok: false, error: "temporary_error" }, 500);
  }
});
