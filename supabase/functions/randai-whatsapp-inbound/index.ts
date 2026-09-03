import { createClient } from "npm:@supabase/supabase-js@2";
import { normalizeWhatsAppNumber, resolveInboundChannel } from "../_shared/whatsapp-policy.js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
const INGRESS_SECRET = Deno.env.get("WHATSAPP_INBOUND_SHARED_SECRET") || "";
const PUBLIC_WEBHOOK_URL = Deno.env.get("WHATSAPP_PUBLIC_WEBHOOK_URL") || "";
const DIRECT_URL = `${SUPABASE_URL}/functions/v1/randai-whatsapp-inbound`;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false, autoRefreshToken: false } });

const xmlEscape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
const twiml = (message = "", status = 200) => new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${message ? `<Message>${xmlEscape(message)}</Message>` : ""}</Response>`, { status, headers: { "content-type": "text/xml; charset=utf-8", "cache-control": "no-store" } });
const normalizeText = (value: string) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9\-\s]/g, " ").replace(/\s+/g, " ").trim();

async function hmacSha1Base64(secret: string, data: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  let binary = "";
  for (const byte of new Uint8Array(signature)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function validTwilioSignature(params: URLSearchParams, provided: string | null, requestUrl: string) {
  if (!TWILIO_TOKEN || !provided) return false;
  const entries = [...params.entries()].sort(([a], [b]) => a.localeCompare(b));
  let signed = requestUrl;
  for (const [key, value] of entries) signed += key + value;
  const expected = await hmacSha1Base64(TWILIO_TOKEN, signed);
  if (expected.length !== provided.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  return diff === 0;
}

function safeEqual(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function signatureUrl(req: Request) {
  const proxyUrl = String(req.headers.get("x-randai-webhook-url") || "").trim();
  if (!proxyUrl) return DIRECT_URL;
  if (!INGRESS_SECRET || !safeEqual(String(req.headers.get("x-randai-whatsapp-shared-secret") || ""), INGRESS_SECRET)) return null;
  try {
    const url = new URL(proxyUrl);
    if (url.protocol !== "https:") return null;
    if (PUBLIC_WEBHOOK_URL && url.toString() !== new URL(PUBLIC_WEBHOOK_URL).toString()) return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function consumeQuota(hotelId: string, fromNumber: string) {
  const senderKey = await sha256(`${hotelId}\u0000${fromNumber}`);
  const { data, error } = await admin.rpc("consume_whatsapp_inbound_quota", { p_hotel_id: hotelId, p_sender_key: senderKey, p_limit: 12, p_window_seconds: 60 });
  if (error) {
    console.error("whatsapp quota", error);
    return false;
  }
  return data === true;
}

async function resolveLocation(hotelId: string, body: string) {
  const candidates = [...new Set(body.match(/\b\d{3,4}\b/g) || [])];
  if (candidates.length) {
    const { data, error } = await admin.from("housekeeping_import_rooms").select("camera").eq("hotel_id", hotelId).in("camera", candidates).limit(candidates.length);
    if (error) console.error("whatsapp room lookup", error);
    const known = new Set((data || []).map((row: any) => String(row.camera)));
    for (const candidate of candidates) if (known.has(candidate)) return candidate;
  }

  const { data: locations, error: locationError } = await admin.from("inventory_locations").select("name,code").eq("hotel_id", hotelId).eq("active", true).limit(500);
  if (locationError) console.error("whatsapp location lookup", locationError);
  const normalizedBody = ` ${normalizeText(body)} `;
  for (const row of locations || []) {
    for (const value of [row.name, row.code]) {
      const normalized = normalizeText(value || "");
      if (normalized && normalizedBody.includes(` ${normalized} `)) return String(row.name || row.code);
    }
  }
  return null;
}

function categoryFrom(body: string) {
  const text = normalizeText(body);
  if (/acqua|rubinett|wc|scaric|doccia|lavandin|perd|idraulic/.test(text)) return "Idraulico";
  if (/luce|lamp|presa|corrente|elettric|interrutt|tv|televis/.test(text)) return "Elettrico";
  if (/aria condizionata|clima|cald|fredd|termostat|fan coil/.test(text)) return "Climatizzazione";
  if (/porta|finestr|mobile|letto|sedia|tavol|armadio|arredo/.test(text)) return "Arredo";
  return "Varie";
}
function urgencyFrom(body: string) {
  const text = normalizeText(body);
  if (/urgente|emergenza|allag|fumo|incend|scintill|perdita forte|non si chiude/.test(text)) return "alta";
  if (/bassa|quando possibile|non urgente/.test(text)) return "bassa";
  return "media";
}

async function preserveImage(hotelId: string, messageSid: string, mediaUrl: string | null, contentType: string | null) {
  if (!mediaUrl || !contentType?.startsWith("image/") || !TWILIO_SID || !TWILIO_TOKEN) return null;
  const response = await fetch(mediaUrl, { headers: { authorization: "Basic " + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`) } });
  if (!response.ok) return null;
  const bytes = new Uint8Array(await response.arrayBuffer());
  const extension = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const path = `${hotelId}/whatsapp/${messageSid}/before.${extension}`;
  const { error } = await admin.storage.from("maintenance-photos").upload(path, bytes, { contentType, upsert: false });
  if (error && !String(error.message || "").toLowerCase().includes("already exists")) console.error("whatsapp media upload", error);
  return path;
}

Deno.serve(async (req: Request) => {
  if (req.method === "GET") return new Response(JSON.stringify({ ok: true, service: "randai-whatsapp-inbound", mode: "receive-first", routing: "db-channel-registry" }), { status: 200, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  if (!TWILIO_TOKEN) return new Response("Twilio not configured", { status: 503 });

  const rawBody = await req.text();
  const params = new URLSearchParams(rawBody);
  const requestUrl = signatureUrl(req);
  if (!requestUrl) return new Response("Forbidden", { status: 403 });
  const valid = await validTwilioSignature(params, req.headers.get("x-twilio-signature"), requestUrl);
  if (!valid) return new Response("Forbidden", { status: 403 });

  const fromNumber = normalizeWhatsAppNumber(params.get("From") || "");
  const toNumber = normalizeWhatsAppNumber(params.get("To") || "");
  const messageSid = params.get("MessageSid") || params.get("SmsMessageSid") || "";
  const body = (params.get("Body") || "").trim();
  const numMedia = Math.max(0, Number(params.get("NumMedia") || 0));
  const mediaUrl = numMedia > 0 ? params.get("MediaUrl0") : null;
  const mediaType = numMedia > 0 ? params.get("MediaContentType0") : null;
  if (!fromNumber || !toNumber || !messageSid) return new Response("Bad Request", { status: 400 });

  const { data: channelRows, error: channelError } = await admin.from("whatsapp_channel_settings").select("hotel_id,inbound_number,receive_enabled,ingestion_enabled,updated_at").eq("inbound_number", toNumber).limit(2);
  if (channelError) { console.error("channel lookup", channelError); return new Response("Configuration error", { status: 503 }); }
  const route = resolveInboundChannel(channelRows || [], toNumber);
  if (!route.ok) {
    if (route.reason === "CHANNEL_NOT_FOUND" || route.reason === "DISABLED" || route.reason === "NOT_CONFIGURED") return twiml("");
    console.error("whatsapp channel routing", route.reason);
    return new Response("Configuration error", { status: 503 });
  }
  const channel = route.channel;

  const { data: duplicate, error: duplicateError } = await admin.from("whatsapp_inbound_messages").select("id,processing_status").eq("message_sid", messageSid).maybeSingle();
  if (duplicateError) { console.error("duplicate lookup", duplicateError); return new Response("Storage error", { status: 503 }); }
  if (duplicate) return twiml("");

  if (!(await consumeQuota(channel.hotel_id, fromNumber))) return twiml("Troppe richieste ravvicinate. Attendi un minuto e riprova.", 429);

  const mediaPath = await preserveImage(channel.hotel_id, messageSid, mediaUrl, mediaType);
  const initialStatus = channel.ingestion_enabled ? "received" : "paused";
  const { data: inbound, error: inboundError } = await admin.from("whatsapp_inbound_messages").insert({
    message_sid: messageSid,
    hotel_id: channel.hotel_id,
    from_number: fromNumber,
    to_number: toNumber,
    body,
    num_media: numMedia,
    media_content_type: mediaType,
    media_storage_path: mediaPath,
    processing_status: initialStatus,
    signature_valid: true,
    metadata: { source: "twilio", preserved_media: Boolean(mediaPath), channel_state: route.reason },
  }).select("id").single();
  if (inboundError) {
    if (String(inboundError.code || "") === "23505") return twiml("");
    console.error("inbound insert", inboundError);
    return new Response("Storage error", { status: 503 });
  }

  if (!channel.ingestion_enabled) return twiml("");

  const location = await resolveLocation(channel.hotel_id, body);
  if (!body || !location) {
    const reply = numMedia > 0 && !body
      ? "Ho ricevuto la foto. Scrivi anche la camera o zona e il problema."
      : "Indica camera o zona e descrivi il problema, così posso creare la segnalazione.";
    await admin.from("whatsapp_inbound_messages").update({ processing_status: "needs_info", reply_text: reply, processed_at: new Date().toISOString() }).eq("id", inbound.id);
    return twiml(reply);
  }

  const category = categoryFrom(body);
  const urgency = urgencyFrom(body);
  const { data: issue, error: issueError } = await admin.from("segnalazioni").insert({
    hotel_id: channel.hotel_id,
    camera: location,
    categoria: category,
    urgenza: urgency,
    note: body.slice(0, 500),
    creato_da: `WhatsApp ${fromNumber}`,
    stato: "todo",
    foto_prima: mediaPath,
    origine: "WhatsApp",
  }).select("id").single();

  if (issueError) {
    console.error("issue create", issueError);
    await admin.from("whatsapp_inbound_messages").update({ processing_status: "error", processed_at: new Date().toISOString(), metadata: { source: "twilio", preserved_media: Boolean(mediaPath), error: "issue_create_failed" } }).eq("id", inbound.id);
    return twiml("Messaggio ricevuto, ma la segnalazione non è stata creata per un problema tecnico. Riprova tra poco.");
  }

  const reply = `Segnalazione creata — ${location} · ${category} · urgenza ${urgency}. Grazie.`;
  await admin.from("whatsapp_inbound_messages").update({ processing_status: "created", issue_id: issue.id, reply_text: reply, processed_at: new Date().toISOString() }).eq("id", inbound.id);
  await admin.from("notification_outbox").insert({ channel: "whatsapp_inbound", hotel_id: channel.hotel_id, recipient: fromNumber, body: body || "[foto]", status: "received", sent_at: new Date().toISOString(), metadata: { twilio_sid: messageSid, issue_id: issue.id, inbound_message_id: inbound.id, photo: Boolean(mediaPath) } });

  return twiml(reply);
});
