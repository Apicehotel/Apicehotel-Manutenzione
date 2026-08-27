// Endpoint pubblico e in sola lettura: restituisce un sottoinsieme sicuro di una
// singola segnalazione, dato il suo id (UUID, di fatto non indovinabile — nessun
// altro segreto richiesto). Usato dalla paginetta pubblica /s/<id> linkata nel
// messaggio WhatsApp al tecnico esterno. Non richiede login.
//
// Espone solo: camera/zona, categoria, urgenza, stato, descrizione, nome struttura,
// data creazione, e un signed URL della foto (se presente) — mai altri dati sensibili
// (nomi del personale, reparto interno, note di completamento, ecc.).

import { createClient } from "npm:@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "GET, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

const BUCKET = "maintenance-photos";
const isDataUrl = (v: unknown) => typeof v === "string" && v.startsWith("data:image/");

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "GET") return json({ ok: false, error: "Metodo non consentito" }, 405);

  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return json({ ok: false, error: "id mancante" }, 400);

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
        const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(row.foto_prima, 60 * 60 * 24 * 7);
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
    console.error("public-issue", error);
    const message = error instanceof Error ? error.message : "Errore";
    return json({ ok: false, error: message }, 500);
  }
});
