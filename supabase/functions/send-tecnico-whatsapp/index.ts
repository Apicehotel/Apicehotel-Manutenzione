// Invia un messaggio WhatsApp al tecnico esterno per una segnalazione, e ne traccia lo
// stato di consegna. Porta 1:1 della funzione omonima di HotelGio (progetto jmhzmwyolxzacjunfwcq),
// adattata allo schema multihotel (tabella segnalazioni, colonna hotel_id).
//
// NON ANCORA ATTIVA: richiede le seguenti secrets su questo progetto Supabase
// (Project Settings > Edge Functions > Secrets), che al momento non sono configurate:
//   TWILIO_ACCOUNT_SID
//   TWILIO_AUTH_TOKEN
//   TWILIO_WHATSAPP_FROM   (es. "whatsapp:+14155238886" — il numero WhatsApp Business approvato)
//
// Uso previsto (stesso pattern di HotelGio):
//   POST { segnalazioneId, telefono, camera, problema }        -> invia il messaggio
//   GET  ?checkSid=<sid>&segnalazioneId=<id>                    -> aggiorna lo stato di consegna

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_FROM = Deno.env.get("TWILIO_WHATSAPP_FROM");

const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

function twilioConfigured() {
  return Boolean(TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM);
}

async function twilioRequest(path: string, body?: URLSearchParams) {
  const auth = btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`);
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Basic ${auth}`, ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || `Twilio error ${res.status}`);
  return data;
}

function normalizeWhatsappNumber(raw: string) {
  const digits = String(raw || "").replace(/[^\d+]/g, "");
  if (!digits) return null;
  return `whatsapp:${digits.startsWith("+") ? digits : `+${digits}`}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!twilioConfigured()) {
    return json({ ok: false, error: "Twilio non configurato: mancano TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_WHATSAPP_FROM tra le secrets di questo progetto." }, 501);
  }

  try {
    const reqUrl = new URL(req.url);
    const checkSid = reqUrl.searchParams.get("checkSid");

    if (req.method === "GET" && checkSid) {
      const segnalazioneId = reqUrl.searchParams.get("segnalazioneId");
      const data = await twilioRequest(`/Messages/${checkSid}.json`);
      if (segnalazioneId) {
        await admin.from("segnalazioni").update({ tecnico_msg_stato: data.status || null }).eq("id", segnalazioneId);
      }
      return json({ ok: true, status: data.status });
    }

    if (req.method !== "POST") return json({ ok: false, error: "Metodo non consentito" }, 405);

    const body = await req.json().catch(() => null);
    const segnalazioneId = String(body?.segnalazioneId || "");
    const telefono = normalizeWhatsappNumber(body?.telefono);
    const camera = String(body?.camera || "");
    const problema = String(body?.problema || "");
    if (!segnalazioneId || !telefono) return json({ ok: false, error: "segnalazioneId e telefono sono obbligatori" }, 400);

    const testo = [`Ciao, c'è un intervento da fare in ${camera}.`, problema ? `Descrizione: ${problema}` : null]
      .filter(Boolean)
      .join("\n\n");

    const params = new URLSearchParams({ From: TWILIO_FROM!, To: telefono, Body: testo });
    const sent = await twilioRequest("/Messages.json", params);

    await admin.from("segnalazioni").update({ tecnico_msg_sid: sent.sid, tecnico_msg_stato: sent.status || null }).eq("id", segnalazioneId);
    return json({ ok: true, sid: sent.sid, status: sent.status });
  } catch (error) {
    console.error("send-tecnico-whatsapp", error);
    const message = error instanceof Error ? error.message : "Errore invio messaggio";
    return json({ ok: false, error: message }, 500);
  }
});
