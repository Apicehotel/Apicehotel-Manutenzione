import postgres from "npm:postgres@3.4.7";

// Postgres diretto: dal 1 ottobre 2026 PostgREST risponde 401 alle chiamate REST
// delle Edge Function con la chiave service_role. La cancellazione dei file passa dall'API Storage.
const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 2, connect_timeout: 5, idle_timeout: 10 });
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

async function secret(key: string): Promise<string | null> {
  const rows = await sql`select value from public.edge_function_secrets where key = ${key} limit 1`;
  return rows[0]?.value ? String(rows[0].value) : null;
}

async function removeObject(path: string): Promise<string | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/randchat-media`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes: [path] }),
    });
    return res.ok ? null : `storage_${res.status}`;
  } catch (e) {
    return e instanceof Error ? e.message : "delete_failed";
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
  try {
    const expected = await secret("randchat_media_cron_secret");
    if (!expected || req.headers.get("x-cron-secret") !== expected) return json({ ok: false, error: "forbidden" }, 403);

    let orphanCount = 0;
    try {
      const r = await sql`select public.queue_orphaned_chat_media() as n`;
      orphanCount = Number(r[0]?.n || 0);
    } catch { return json({ ok: false, error: "orphan_scan_failed" }, 500); }

    const rows = await sql`select id, storage_provider, storage_path, attempts from public.chat_media_gc_queue order by queued_at asc limit 100`;

    let deleted = 0;
    let failed = 0;
    for (const row of rows) {
      if (row.storage_provider !== "supabase") {
        await sql`update public.chat_media_gc_queue set attempts = ${Number(row.attempts || 0) + 1}, last_error = 'provider_not_supported' where id = ${row.id}`;
        failed += 1;
        continue;
      }
      const err = await removeObject(String(row.storage_path));
      if (err) {
        await sql`update public.chat_media_gc_queue set attempts = ${Number(row.attempts || 0) + 1}, last_error = ${err.slice(0, 500)} where id = ${row.id}`;
        failed += 1;
        continue;
      }
      await sql`delete from public.chat_media_gc_queue where id = ${row.id}`;
      deleted += 1;
    }

    return json({ ok: true, orphansQueued: orphanCount, processed: rows.length, deleted, failed });
  } catch (e) {
    console.error("randchat-media-cleanup failed", e instanceof Error ? e.message : "unknown");
    return json({ ok: false, error: "temporary_error" }, 500);
  }
});
