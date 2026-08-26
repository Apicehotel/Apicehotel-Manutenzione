import { createClient } from "npm:@supabase/supabase-js@2";
import { HOTEL_LOCATIONS, isKnownRoom, resolveCamera, zoneReference } from "./locations.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const PUBLIC_URL = "https://ooqlfldcrnkudhgjnied.supabase.co/functions/v1/whatsapp-webhook";

const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

const CATEGORIE = ["Idraulico", "Elettrico", "Climatizzazione", "Arredo", "Varie"];
const URGENZE = ["alta", "media", "bassa"];

// ---------- utilita' comuni ----------
const xmlEscape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const twiml = (s: string, status = 200) =>
  new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${s ? `<Message>${xmlEscape(s)}</Message>` : ""}</Response>`, {
    status,
    headers: { "Content-Type": "text/xml", "Cache-Control": "no-store" },
  });

function normalizeWa(raw: string): string | null {
  const stripped = String(raw || "").trim().replace(/^whatsapp:/, "").replace(/[^\d+]/g, "");
  if (!stripped) return null;
  if (stripped.startsWith("+")) return /^\+[1-9]\d{7,14}$/.test(stripped) ? stripped : null;
  if (stripped.startsWith("39")) return `+${stripped}`;
  return `+39${stripped}`;
}
function phoneDigits(s: string): string { return (s || "").replace(/\D/g, ""); }
function phoneKey(s: string): string { return phoneDigits(s).slice(-9); }
function phonesMatch(a: string, b: string): boolean {
  const da = phoneDigits(a), db = phoneDigits(b);
  if (!da || !db) return false;
  return da.slice(-9) === db.slice(-9);
}

async function hmacSha1Base64(secret: string, data: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  let bin = ""; for (const b of new Uint8Array(sig)) bin += String.fromCharCode(b);
  return btoa(bin);
}
async function validTwilioSignature(params: URLSearchParams, provided: string | null) {
  if (!TWILIO_TOKEN || !provided) return false;
  const entries = [...params.entries()].sort(([a], [b]) => a.localeCompare(b));
  let data = PUBLIC_URL; for (const [k, v] of entries) data += k + v;
  const expected = await hmacSha1Base64(TWILIO_TOKEN, data);
  if (expected.length !== provided.length) return false;
  let diff = 0; for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  return diff === 0;
}

// ---------- AI (opzionale, con fallback deterministico) ----------
let cachedAnthropicKey: string | null | undefined;
async function getAnthropicKey(): Promise<string | null> {
  if (cachedAnthropicKey !== undefined) return cachedAnthropicKey;
  const { data } = await admin.from("edge_function_secrets").select("value").eq("key", "anthropic_api_key").maybeSingle();
  cachedAnthropicKey = data?.value || null;
  return cachedAnthropicKey;
}
async function callClaude(system: string, userText: string): Promise<any | null> {
  const key = await getAnthropicKey();
  if (!key) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 300, system, messages: [{ role: "user", content: userText }] }),
    });
    if (!res.ok) { console.error("Anthropic error", res.status, await res.text()); return null; }
    const data = await res.json();
    const raw: string = data.content?.[0]?.text ?? "";
    const match = raw.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch (e) { console.error("Anthropic call failed", e); return null; }
}

function inferCategoryFallback(text: string): string {
  const t = text.toLowerCase();
  if (/acqua|rubinett|wc|water|scaric|doccia|lavandin|perd|idraulic/.test(t)) return "Idraulico";
  if (/luce|lamp|presa|corrente|elettric|interrutt|tv|televis/.test(t)) return "Elettrico";
  if (/aria condizionata|clima|cald|fredd|termostat|fan ?coil/.test(t)) return "Climatizzazione";
  if (/porta|finestr|mobile|letto|sedia|tavol|armadio|arredo/.test(t)) return "Arredo";
  return "Varie";
}
function inferUrgencyFallback(text: string): string {
  const t = text.toLowerCase();
  if (/urgente|emergenza|allag|fumo|incend|scintill|perdita.*forte|non si chiude/.test(t)) return "alta";
  if (/bassa|quando possibile|non urgente/.test(t)) return "bassa";
  return "media";
}
function parseRoomFallback(hotelId: string, text: string): string | null {
  const m = text.match(/\b(\d{2,4})\b/);
  if (m && isKnownRoom(hotelId, m[1])) return m[1];
  return resolveCamera(hotelId, text);
}

async function extractIssue(hotelId: string, text: string) {
  const system = `Sei un assistente che estrae dati strutturati da messaggi WhatsApp per segnalazioni di manutenzione in un hotel.
Estrai dal messaggio dell'utente questi campi:
- camera: individua a cosa si riferisce il messaggio, in uno di questi due modi SOLO:
  (a) un numero di camera ospiti reale: estrai SOLO le cifre, senza prefissi.
  (b) una delle ZONE UFFICIALI elencate qui sotto, se il messaggio la nomina anche con un sinonimo: restituisci ESATTAMENTE la stringa come scritta nell'elenco.
  Se non riesci a determinare con sicurezza, restituisci null.

Elenco ZONE UFFICIALI per questa struttura:
${zoneReference(hotelId)}

- categoria: una tra: Idraulico, Elettrico, Climatizzazione, Arredo, Varie.
- urgenza: una tra: alta, media, bassa.
- note: breve descrizione pulita del problema in italiano, max 200 caratteri.

Rispondi SOLO con un oggetto JSON valido con queste 4 chiavi. Se il messaggio non riguarda manutenzione, rispondi con {"camera": null}.`;
  const ai = await callClaude(system, text);
  if (ai && ai.camera !== undefined) {
    const camera = ai.camera ? resolveCamera(hotelId, ai.camera) || (isKnownRoom(hotelId, String(ai.camera)) ? String(ai.camera) : null) : null;
    if (camera) {
      return {
        camera,
        categoria: CATEGORIE.includes(ai.categoria) ? ai.categoria : inferCategoryFallback(text),
        urgenza: URGENZE.includes(ai.urgenza) ? ai.urgenza : inferUrgencyFallback(text),
        note: (ai.note || text).toString().slice(0, 500),
        aiUsed: true,
      };
    }
  }
  // fallback deterministico (sempre disponibile, nessuna chiave richiesta)
  const camera = parseRoomFallback(hotelId, text);
  return { camera, categoria: inferCategoryFallback(text), urgenza: inferUrgencyFallback(text), note: text.slice(0, 500), aiUsed: false };
}

async function extractConfermaArrivo(text: string): Promise<{ tipo: string; arrivo_iso: string | null; testo: string }> {
  const oraCorrente = new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome" });
  const isoCorrente = new Date().toISOString();
  const system = `Sei un assistente che interpreta la risposta di un tecnico esterno a una richiesta di intervento in un hotel.
Data e ora attuali: ${oraCorrente} (ISO: ${isoCorrente}), fuso orario Europe/Rome.

Classifica il messaggio del tecnico in UNO di questi 4 tipi:
- "orario_preciso": da' un giorno/ora specifico o abbastanza specifico. Calcola la data/ora assoluta risultante.
- "generico": conferma che arriva ma senza orario preciso (es. "ok arrivo", "va bene").
- "rifiuto": non puo' venire o chiede di contattare qualcun altro.
- "incomprensibile": non interpretabile come risposta a una richiesta di intervento.

Rispondi SOLO con: {"tipo": "...", "arrivo_iso": "ISO 8601 oppure null", "testo": "riassunto breve, max 150 caratteri"}`;
  const ai = await callClaude(system, text);
  if (ai && ai.tipo) return { tipo: ai.tipo, arrivo_iso: ai.arrivo_iso || null, testo: (ai.testo || text).toString().slice(0, 200) };

  // fallback deterministico senza AI
  const t = text.toLowerCase();
  if (/non posso|impossibile|non riesco|chiama (un )?altro|non ce la faccio/.test(t)) return { tipo: "rifiuto", arrivo_iso: null, testo: text.slice(0, 200) };
  if (/\bok\b|va bene|arrivo|confermo|ci sono|d'accordo/.test(t)) return { tipo: "generico", arrivo_iso: null, testo: text.slice(0, 200) };
  return { tipo: "incomprensibile", arrivo_iso: null, testo: text.slice(0, 200) };
}

// ---------- camera in sospeso (flusso a due passaggi) ----------
async function setPendingCamera(hotelId: string, from: string, camera: string) {
  await admin.from("whatsapp_pending_camera").upsert({ hotel_id: hotelId, phone_key: phoneKey(from), camera, created_at: new Date().toISOString() });
}
async function getPendingCamera(hotelId: string, from: string): Promise<string | null> {
  const { data } = await admin.from("whatsapp_pending_camera").select("camera").eq("hotel_id", hotelId).eq("phone_key", phoneKey(from)).maybeSingle();
  return data?.camera || null;
}
async function clearPendingCamera(hotelId: string, from: string) {
  await admin.from("whatsapp_pending_camera").delete().eq("hotel_id", hotelId).eq("phone_key", phoneKey(from));
}

// ---------- foto ----------
async function uploadTwilioImage(mediaUrl: string, contentType: string, hotelId: string): Promise<string | null> {
  if (!TWILIO_SID || !TWILIO_TOKEN) return null;
  const res = await fetch(mediaUrl, { headers: { Authorization: "Basic " + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`) } });
  if (!res.ok) return null;
  const bytes = new Uint8Array(await res.arrayBuffer());
  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const path = `${hotelId}/issues/${crypto.randomUUID()}/before.${ext}`;
  const up = await fetch(`${SUPABASE_URL}/storage/v1/object/maintenance-photos/${path}`, {
    method: "POST",
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": contentType || "image/jpeg", "x-upsert": "false" },
    body: bytes,
  });
  return up.ok ? path : null;
}

// ---------- conferma arrivo tecnico ----------
async function findSegnalazioneInAttesaTecnico(hotelId: string, fromPhone: string) {
  const { data } = await admin
    .from("segnalazioni")
    .select("id,camera,tecnico_telefono,tecnico_nome")
    .eq("hotel_id", hotelId)
    .eq("tecnico_risposta_stato", "in_attesa")
    .not("tecnico_telefono", "is", null)
    .order("tecnico_richiesto_il", { ascending: false, nullsFirst: false })
    .limit(25);
  return (data || []).find((r: any) => phonesMatch(r.tecnico_telefono || "", fromPhone)) || null;
}

async function notifyRifiutoTecnico(hotelId: string, camera: string) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE}`, apikey: SERVICE },
      body: JSON.stringify({ hotel_id: hotelId, event_type: "tecnico_rifiutato", room: camera, note: `Il tecnico contattato per ${camera} non puo' venire.` }),
    });
  } catch (e) { console.error("notifyRifiutoTecnico", e); }
}

async function tryHandleTecnicoConfermaArrivo(hotelId: string, fromPhone: string, body: string): Promise<{ reply: string; handled: boolean }> {
  const seg = await findSegnalazioneInAttesaTecnico(hotelId, fromPhone);
  if (!seg) return { reply: "", handled: false };
  const parsed = await extractConfermaArrivo(body);

  if (parsed.tipo === "orario_preciso" && parsed.arrivo_iso) {
    await admin.from("segnalazioni").update({ tecnico_risposta_stato: "confermato", tecnico_arrivo_testo: parsed.testo, tecnico_arrivo_previsto: parsed.arrivo_iso }).eq("id", seg.id);
    return { reply: `✅ Segnato: arrivo camera ${seg.camera}. Grazie!`, handled: true };
  }
  if (parsed.tipo === "generico") {
    await admin.from("segnalazioni").update({ tecnico_risposta_stato: "generico", tecnico_arrivo_testo: parsed.testo }).eq("id", seg.id);
    return { reply: `✅ Segnato: confermato per camera ${seg.camera}. Grazie!`, handled: true };
  }
  if (parsed.tipo === "rifiuto") {
    await admin.from("segnalazioni").update({ tecnico_risposta_stato: "rifiutato", tecnico_arrivo_testo: parsed.testo }).eq("id", seg.id);
    await notifyRifiutoTecnico(hotelId, seg.camera);
    return { reply: "Ok, grazie per averci avvisato.", handled: true };
  }
  return { reply: "", handled: true };
}

// ---------- pipeline messaggio in arrivo ----------
async function insertSegnalazione(hotelId: string, fields: { camera: string; categoria: string; urgenza: string; note: string; creatoDa: string; fotoPath: string | null }) {
  const { data, error } = await admin
    .from("segnalazioni")
    .insert({ hotel_id: hotelId, camera: fields.camera, categoria: fields.categoria, urgenza: fields.urgenza, note: fields.note, creato_da: fields.creatoDa, stato: "todo", foto_prima: fields.fotoPath, origine: "WhatsApp" })
    .select("id")
    .single();
  if (error) { console.error("insertSegnalazione", error); return null; }
  return data;
}

async function processMessage(hotelId: string, body: string, from: string, mediaUrl: string | null, mediaType: string): Promise<string> {
  const trimmed = body.trim();

  if (/^\d{1,4}$/.test(trimmed) && isKnownRoom(hotelId, trimmed)) {
    await setPendingCamera(hotelId, from, trimmed);
    return `Camera ${trimmed}. Qual è il problema?`;
  }

  const pending = await getPendingCamera(hotelId, from);
  const targetText = pending ? trimmed : body;
  const extracted = pending ? { camera: pending, ...(await extractIssue(hotelId, body)) } : await extractIssue(hotelId, body);
  const camera = pending || extracted.camera;

  if (!camera) {
    return `Non ho capito a quale camera o zona si riferisce. Riscrivi indicando il numero della camera e il problema (es: "camera 204, perde il rubinetto del bagno").`;
  }

  let fotoPath: string | null = null;
  if (mediaUrl && mediaType.startsWith("image/")) fotoPath = await uploadTwilioImage(mediaUrl, mediaType, hotelId);

  const created = await insertSegnalazione(hotelId, {
    camera,
    categoria: extracted.categoria,
    urgenza: extracted.urgenza,
    note: extracted.note || targetText.slice(0, 500),
    creatoDa: `WhatsApp ${from}`,
    fotoPath,
  });
  if (pending) await clearPendingCamera(hotelId, from);

  if (!created) return `📝 Ricevuto — Camera ${camera}. C'è un problema tecnico momentaneo: riprova tra poco se non ricevi conferma.`;

  await admin.from("notification_outbox").insert({
    channel: "whatsapp_inbound", hotel_id: hotelId, recipient: from, body: body || "[foto]", status: "received", sent_at: new Date().toISOString(),
    metadata: { from, issue_id: created.id, photo: Boolean(fotoPath) },
  });
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE}`, apikey: SERVICE },
      body: JSON.stringify({ hotel_id: hotelId, event_type: "issue_created", issue_id: created.id, room: camera, category: extracted.categoria, note: extracted.note }),
    });
  } catch {}

  const fotoNote = fotoPath ? "\n📷 Foto allegata." : "";
  return `✅ Segnalazione creata — camera ${camera} · ${extracted.categoria} · Urgenza ${extracted.urgenza}.${fotoNote} Grazie.`;
}

// ---------- entrypoint ----------
Deno.serve(async (req: Request) => {
  if (req.method === "GET") return new Response("OK - multihotel whatsapp webhook (v2, con AI opzionale e riconoscimento zone)", { status: 200 });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  if (!TWILIO_TOKEN) return new Response("Twilio not configured", { status: 503 });

  const raw = await req.text();
  const params = new URLSearchParams(raw);
  if (!(await validTwilioSignature(params, req.headers.get("X-Twilio-Signature")))) return new Response("Forbidden", { status: 403 });

  const from = normalizeWa(params.get("From") || "");
  const to = normalizeWa(params.get("To") || "");
  const body = (params.get("Body") || "").trim();
  const messageSid = params.get("MessageSid") || params.get("SmsMessageSid") || "";
  if (!from || !to) return twiml("Numero WhatsApp non valido.");

  const { data: setting } = await admin.from("integration_settings").select("enabled,config").eq("key", "twilio_whatsapp").maybeSingle();
  if (!setting?.enabled) return twiml("Il servizio manutenzioni WhatsApp è temporaneamente disattivato.");
  const inbound = setting?.config?.inbound_numbers || {};
  const hotelId = inbound[`whatsapp:${to}`] || inbound[to];
  if (!hotelId || !HOTEL_LOCATIONS[hotelId]) return twiml("Questo numero non è associato a una struttura configurata.");

  if (messageSid) {
    const { data: dup } = await admin.from("notification_outbox").select("id").eq("channel", "whatsapp_inbound").contains("metadata", { twilio_sid: messageSid }).limit(1).maybeSingle();
    if (dup) return twiml("");
  }

  // priorita' 1: risposta di un tecnico in attesa (qualsiasi testo)
  if (body) {
    try {
      const conferma = await tryHandleTecnicoConfermaArrivo(hotelId, from, body);
      if (conferma.handled) return twiml(conferma.reply);
    } catch (e) { console.error("conferma tecnico", e); }
  }

  if (!body) {
    const numMedia = Number(params.get("NumMedia") || 0);
    if (numMedia > 0) return twiml("Ho ricevuto la foto ma senza didascalia. Rimanda la foto scrivendo nella didascalia il numero della camera e il problema.");
    return twiml("Non ho ricevuto testo. Riscrivi indicando camera e problema.");
  }

  const numMedia = Number(params.get("NumMedia") || 0);
  const mediaUrl = numMedia > 0 ? params.get("MediaUrl0") : null;
  const mediaType = params.get("MediaContentType0") || "";

  try {
    const reply = await processMessage(hotelId, body, from, mediaUrl, mediaType);
    return twiml(reply);
  } catch (err) {
    console.error("whatsapp-webhook error", err);
    return twiml("📝 Ricevuto, ma c'è stato un problema tecnico momentaneo. Riprova tra poco.");
  }
});
