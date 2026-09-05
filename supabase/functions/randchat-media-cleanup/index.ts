import { createClient } from "npm:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

async function secret(key: string) {
  const { data } = await admin.from("edge_function_secrets").select("value").eq("key", key).maybeSingle();
  return data?.value || null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
  const expected = await secret("randchat_media_cron_secret");
  if (!expected || req.headers.get("x-cron-secret") !== expected) return json({ ok: false, error: "forbidden" }, 403);

  const { data: rows, error: readError } = await admin
    .from("chat_media_gc_queue")
    .select("id,storage_provider,storage_path,attempts")
    .order("queued_at", { ascending: true })
    .limit(100);
  if (readError) return json({ ok: false, error: "queue_read_failed" }, 500);

  let deleted = 0;
  let failed = 0;
  for (const row of rows || []) {
    if (row.storage_provider !== "supabase") {
      await admin.from("chat_media_gc_queue").update({ attempts: Number(row.attempts || 0) + 1, last_error: "provider_not_supported" }).eq("id", row.id);
      failed += 1;
      continue;
    }
    const { error } = await admin.storage.from("randchat-media").remove([String(row.storage_path)]);
    if (error) {
      await admin.from("chat_media_gc_queue").update({ attempts: Number(row.attempts || 0) + 1, last_error: String(error.message || "delete_failed").slice(0, 500) }).eq("id", row.id);
      failed += 1;
      continue;
    }
    await admin.from("chat_media_gc_queue").delete().eq("id", row.id);
    deleted += 1;
  }

  return json({ ok: true, processed: (rows || []).length, deleted, failed });
});
