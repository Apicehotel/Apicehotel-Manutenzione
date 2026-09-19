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
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

const HOTEL_CODE: Record<string, string> = { hotelgio: "HG", chocohotel: "HC", brigantino: "HB" };
const safeTag = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_]/g, "");
const ticketTag = (code: string) => "#" + safeTag(code.replace(/-/g, ""));
const roomTag = (room: string) => {
  const match = room.match(/(?:camera\s*[·:\-]?\s*)?(\d{1,4})/i);
  return match ? "#camera" + match[1] : "";
};

function topicFor(hotelId: string, kind: "issue" | "intervention") {
  const code = HOTEL_CODE[hotelId];
  if (!code) return null;
  const suffix = kind === "issue" ? "SEGNALAZIONI" : "INTERVENTI";
  const raw = Deno.env.get(`TELEGRAM_TOPIC_${code}_${suffix}`);
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

async function telegram(method: string, body: Record<string, unknown>) {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!token) throw new Error("telegram_bot_token_missing");
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) throw new Error(String(payload?.description || "telegram_delivery_failed"));
  return payload?.result;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  try {
    const client = createClient(url, anon, {
      global: { headers: { Authorization: req.headers.get("authorization") || "" } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData.user) return json({ ok: false, error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const kind = body?.kind === "intervention" ? "intervention" : "issue";
    const recordId = String(body?.record_id || "").trim();
    const phase = String(body?.phase || (kind === "issue" ? "created" : "completed")).trim();
    if (!recordId) return json({ ok: false, error: "record_id_required" }, 400);

    const table = kind === "issue" ? "segnalazioni" : "interventi";
    const select = kind === "issue"
      ? "id,hotel_id,ticket_code,camera,categoria,note,foto_prima,foto_dopo,stato"
      : "id,hotel_id,ticket_code,camera,categoria,note,foto_dopo,stato,sezione";
    const { data: row, error: rowError } = await admin.from(table).select(select).eq("id", recordId).maybeSingle();
    if (rowError || !row) return json({ ok: false, error: "record_not_found" }, 404);

    const { data: membership } = await admin.from("hotel_memberships")
      .select("active").eq("auth_user_id", userData.user.id).eq("hotel_id", row.hotel_id).maybeSingle();
    if (!membership?.active) return json({ ok: false, error: "forbidden" }, 403);

    const chatId = String(Deno.env.get("TELEGRAM_BACKUP_CHAT_ID") || "").trim();
    const threadId = topicFor(row.hotel_id, kind);
    if (!chatId || !threadId) return json({ ok: false, error: "telegram_route_not_configured" }, 503);

    const hotelCode = HOTEL_CODE[row.hotel_id] || String(row.hotel_id).slice(0, 2).toUpperCase();
    const ticketCode = String(row.ticket_code || `${hotelCode}-${String(recordId).slice(0, 4).toUpperCase()}`);
    const location = String(row.camera || "").trim();
    const description = String(row.note || "").trim();
    const category = String(row.categoria || (kind === "issue" ? "manutenzione" : "intervento")).trim();
    const tags = [
      ticketTag(ticketCode),
      roomTag(location),
      "#" + hotelCode.toLowerCase(),
      "#" + safeTag(category.toLowerCase()),
      kind === "issue" ? "#segnalazione" : "#intervento",
      phase === "completed" ? "#dopo" : "#prima",
    ].filter(Boolean);

    const caption = [
      `${ticketCode}${location ? " · " + location : ""}`,
      description,
      "",
      tags.join(" "),
    ].filter((line, index, all) => line || (index > 0 && index < all.length - 1)).join("\n").slice(0, 1024);

    const mediaPath = kind === "issue"
      ? (phase === "completed" ? row.foto_dopo : row.foto_prima)
      : row.foto_dopo;

    let result;
    if (mediaPath) {
      const { data: signed, error: signError } = await admin.storage.from("maintenance-photos").createSignedUrl(String(mediaPath), 300);
      if (signError || !signed?.signedUrl) return json({ ok: false, error: "media_sign_failed" }, 500);
      const lower = String(mediaPath).toLowerCase();
      const isVideo = /\.(mp4|mov|m4v|webm)$/.test(lower);
      result = await telegram(isVideo ? "sendVideo" : "sendPhoto", {
        chat_id: chatId,
        message_thread_id: threadId,
        [isVideo ? "video" : "photo"]: signed.signedUrl,
        caption,
      });
    } else {
      result = await telegram("sendMessage", {
        chat_id: chatId,
        message_thread_id: threadId,
        text: caption,
      });
    }

    return json({ ok: true, message_id: result?.message_id || null, ticket_code: ticketCode, thread_id: threadId });
  } catch (error) {
    console.error("telegram-backup", error instanceof Error ? error.message : "unknown");
    return json({ ok: false, error: "telegram_backup_failed" }, 500);
  }
});
