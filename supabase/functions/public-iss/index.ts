// Endpoint pubblico e in sola lettura: restituisce un sottoinsieme sicuro di una
// singola segnalazione. Solo token opaco `public_share_token` (link /s/<48-hex>).
// UUID legacy disabilitato (410): rigenerare il link WhatsApp dall'app.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "GET, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });

const BUCKET = "maintenance-photos";
const isDataUrl = (v: unknown) => typeof v === "string" && v.startsWith("data:image/");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHARE_TOKEN = /^[0-9a-f]{48}$/i;

const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;
const rateHits = new Map<string, { count: number; resetAt: number }>();

function clientIp(req: Request) {
  const xf = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
  const real = req.headers.get("x-real-ip")?.trim() || "";
  return xf || real || "unknown";
}

function allowPublicRead(req: Request) {
  const key = clientIp(req);
  const now = Date.now();
  const row = rateHits.get(key);
  if (!row || now >= row.resetAt) {
    rateHits.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (row.count >= RATE_LIMIT) return false;
  row.count += 1;
  return true;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "GET") return json({ ok: false, error: "Metodo non consentito" }, 405);

  try {
    if (!allowPublicRead(req)) return json({ ok: false, error: "Troppe richieste. Riprova tra un minuto." }, 429);

    const raw = new URL(req.url).searchParams.get("id")?.trim() || "";
    if (!raw) return json({ ok: false, error: "Identificativo non valido" }, 400);

    if (UUID.test(raw)) {
      return json({ ok: false, error: "legacy_uuid_disabled", detail: "Link UUID non più valido. Apri la segnalazione in RandApp e condividi di nuovo." }, 410);
    }
    if (!SHARE_TOKEN.test(raw)) return json({ ok: false, error: "Identificativo non valido" }, 400);

    const query = admin
      .from("segnalazioni")
      .select("id,hotel_id,camera,categoria,urgenza,stato,note,foto_prima,creato_il,public_share_token")
      .eq("public_share_token", raw);

    const { data: row, error } = await query.maybeSingle();
    if (error) throw error;
    if (!row) return json({ ok: false, error: "Segnalazione non trovata" }, 404);

    const { data: hotel } = await admin.from("hotels").select("nome").eq("id", row.hotel_id).maybeSingle();

    let photoUrl: string | null = null;
    if (row.foto_prima) {
      if (isDataUrl(row.foto_prima)) photoUrl = row.foto_prima;
      else {
        // Il link pubblico alla segnalazione può essere riaperto in qualsiasi momento,
        // ma il link diretto alla foto dura soltanto 15 minuti e viene rigenerato.
        const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(row.foto_prima, 60 * 15);
        photoUrl = signed?.signedUrl || null;
      }
    }

    return json({
      ok: true,
      issue: {
        id: row.id,
        hotelName: hotel?.nome || null,
        room: row.camera,
        category: row.categoria,
        urgency: row.urgenza,
        status: row.stato,
        title: row.note,
        photoUrl,
        createdAt: row.creato_il,
      },
    });
  } catch (error) {
    console.error("public-issue", error instanceof Error ? error.name : "unknown");
    return json({ ok: false, error: "Servizio temporaneamente non disponibile" }, 500);
  }
});
