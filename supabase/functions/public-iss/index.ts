// Endpoint pubblico e in sola lettura: restituisce un sottoinsieme sicuro di una
// singola segnalazione, dato il suo id. Non richiede login e non restituisce mai
// dati del personale, credenziali o dettagli tecnici del backend.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "GET, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });

const BUCKET = "maintenance-photos";
const isDataUrl = (v: unknown) => typeof v === "string" && v.startsWith("data:image/");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "GET") return json({ ok: false, error: "Metodo non consentito" }, 405);

  try {
    const id = new URL(req.url).searchParams.get("id")?.trim() || "";
    if (!UUID.test(id)) return json({ ok: false, error: "Identificativo non valido" }, 400);

    const { data: row, error } = await admin
      .from("segnalazioni")
      .select("id,hotel_id,camera,categoria,urgenza,stato,note,foto_prima,creato_il")
      .eq("id", id)
      .maybeSingle();
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
