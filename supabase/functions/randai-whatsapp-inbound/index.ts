import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
const DIRECT_URL = `${SUPABASE_URL}/functions/v1/randai-whatsapp-inbound`;
const ALLOWED_PROXY_URL = "https://apicehotel.vercel.app/api/whatsapp/incoming";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false, autoRefreshToken: false } });

const xmlEscape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
const twiml = (message = "", status = 200) => new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${message ? `<Message>${xmlEscape(message)}</Message>` : ""}</Response>`, { status, headers: { "content-type": "text/xml; charset=utf-8", "cache-control": "no-store" } });
const digits = (value: string) => String(value || "").replace(/\D/g, "");
const normalizeNumber = (value: string) => {
  const raw = String(value || "").trim().replace(/^whatsapp:/i, "");
  const d = digits(raw);
  if (!d) return null;
  if (raw.startsWith("+")) return `+${d}`;
  if (d.startsWith("39")) return `+${d}`;
  return `+39${d}`;
};

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

const ranges = (start: number, end: number, excluded: number[] = []) => {
  const block = new Set(excluded);
  const result = new Set<string>();
  for (let n = start; n <= end; n++) if (!block.has(n)) result.add(String(n));
  return result;
};
const GIO_ROOMS = new Set<string>([
  ...ranges(1101, 1121, [1113, 1117]), ...ranges(2201, 2221, [2213, 2217]),
  ...ranges(3301, 3321, [3313, 3317]), ...ranges(4401, 4421, [4413, 4417]),
  ...ranges(101, 131, [118]), ...ranges(201, 233, [215]), ...ranges(301, 332, [316]), ...ranges(401, 434, [416]),
]);
const CHOCO_ROOMS = new Set<string>([...ranges(201, 232), ...ranges(301, 332), ...ranges(401, 430)]);
const BRIG_ROOMS = new Set<string>([...ranges(101, 124), ...ranges(201, 224)]);
const ROOM_SETS: Record<string, Set<string>> = { hotelgio: GIO_ROOMS, chocohotel: CHOCO_ROOMS, brigantino: BRIG_ROOMS };
const ZONES: Record<string, string[]> = {
  hotelgio: ["Hall Jazz","Hall Wine","Reception","Centro Congressi","Piscina","Palestra","Giardino Jazz","Giardino Wine","Risto Wine","Sala Colazioni","Auditorium","Magazzino Elettronico","Magazzino Idrailico","Magazzino Tavoli"],
  chocohotel: ["Hall Chocohotel","Parcheggio Hall","Ingresso Hall","Choco Store","Sala Fondente 1","Sala Fondente 2","Sala Gianduia","Sala Latte","Locale Caldaie","Giardino 1 piano","Parcheggio 1 Piano","Isola dei golosi","Piscina","Giardino Piscina","Garage -1 Chocohotel"],
  brigantino: ["Hall","Bar Hall","Saletta Hall","Sala Hall","Sala Colazioni","Parcheggio Frontale","Parcheggio Spiaggia","Spiaggia","Cucina Colazioni","Corridoio Piano 1","Corridoio Piano 2","Scale Esterne","Terrazzo Mare","Piscina"],
};
const normalizeText = (value: string) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9\-\s]/g, " ").replace(/\s+/g, " ").trim();

function resolveLocation(hotelId: string, body: string) {
  const candidates = body.match(/\b\d{3,4}\b/g) || [];
  const rooms = ROOM_SETS[hotelId] || new Set<string>();
  for (const candidate of candidates) if (rooms.has(candidate)) return candidate;
  const normalizedBody = ` ${normalizeText(body)} `;
  for (const zone of ZONES[hotelId] || []) {
    const normalizedZone = normalizeText(zone);
    if (normalizedZone && normalizedBody.includes(` ${normalizedZone} `)) return zone;
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
  if (req.method === "GET") return new Response(JSON.stringify({ ok: true, service: "randai-whatsapp-inbound", mode: "receive-first" }), { status: 200, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  if (!TWILIO_TOKEN) return new Response("Twilio not configured", { status: 503 });

  const rawBody = await req.text();
  const params = new URLSearchParams(rawBody);
  const proxyUrl = req.headers.get("x-randai-webhook-url");
  const signatureUrl = proxyUrl === ALLOWED_PROXY_URL ? ALLOWED_PROXY_URL : DIRECT_URL;
  const valid = await validTwilioSignature(params, req.headers.get("x-twilio-signature"), signatureUrl);
  if (!valid) return new Response("Forbidden", { status: 403 });

  const fromNumber = normalizeNumber(params.get("From") || "");
  const toNumber = normalizeNumber(params.get("To") || "");
  const messageSid = params.get("MessageSid") || params.get("SmsMessageSid") || "";
  const body = (params.get("Body") || "").trim();
  const numMedia = Math.max(0, Number(params.get("NumMedia") || 0));
  const mediaUrl = numMedia > 0 ? params.get("MediaUrl0") : null;
  const mediaType = numMedia > 0 ? params.get("MediaContentType0") : null;
  if (!fromNumber || !toNumber || !messageSid) return new Response("Bad Request", { status: 400 });

  const { data: channel, error: channelError } = await admin.from("whatsapp_channel_settings").select("hotel_id,inbound_number,receive_enabled,ingestion_enabled").eq("inbound_number", toNumber).maybeSingle();
  if (channelError) { console.error("channel lookup", channelError); return new Response("Configuration error", { status: 503 }); }
  if (!channel?.hotel_id || !channel.receive_enabled) return twiml("");

  const { data: duplicate } = await admin.from("whatsapp_inbound_messages").select("id,processing_status").eq("message_sid", messageSid).maybeSingle();
  if (duplicate) return twiml("");

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
    metadata: { source: "twilio", preserved_media: Boolean(mediaPath) },
  }).select("id").single();
  if (inboundError) { console.error("inbound insert", inboundError); return new Response("Storage error", { status: 503 }); }

  if (!channel.ingestion_enabled) return twiml("");

  const location = resolveLocation(channel.hotel_id, body);
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
