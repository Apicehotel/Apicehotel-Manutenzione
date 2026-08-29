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
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const normalize = (value: unknown) => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function scoreProcedure(item: any, query: string) {
  const text = normalize(query);
  let score = 0;
  for (const keyword of item.keywords || []) {
    const token = normalize(keyword);
    if (token && text.includes(token)) score += token.includes(" ") ? 3 : 2;
  }
  for (const field of [item.category, item.area, item.symptom]) {
    const token = normalize(field);
    if (token && text.includes(token)) score += 3;
  }
  return score;
}

function scoreHistory(item: any, query: string, procedure: any) {
  const words = normalize(query).split(/\s+/).filter((word) => word.length > 3);
  const haystack = normalize([item.location, item.camera, item.category, item.categoria, item.description, item.note, item.completion_note, item.pezzo_nome, item.pezzo_sostituito, item.sezione].join(" "));
  let score = words.reduce((total, word) => total + (haystack.includes(word) ? 1 : 0), 0);
  if (procedure?.category && haystack.includes(normalize(procedure.category))) score += 3;
  if (procedure?.area && haystack.includes(normalize(procedure.area))) score += 2;
  return score;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
  try {
    const client = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("authorization") || "" } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData.user) return json({ ok: false, error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const hotelId = String(body?.hotel_id || "").trim();
    const query = String(body?.query || "").trim().slice(0, 1500);
    if (!hotelId || !query) return json({ ok: false, error: "hotel_and_query_required" }, 400);

    const { data: membership } = await admin.from("hotel_memberships").select("active").eq("auth_user_id", userData.user.id).eq("hotel_id", hotelId).maybeSingle();
    if (!membership?.active) return json({ ok: false, error: "forbidden" }, 403);

    const [memoryResult, sensorResult] = await Promise.all([
      admin.rpc("randai_search_memory", { p_hotel_id: hotelId, p_query: query, p_limit: 3 }),
      admin.rpc("randai_sensor_context", { p_hotel_id: hotelId, p_query: query }),
    ]);
    if (memoryResult.error) throw memoryResult.error;
    const sensors = sensorResult.error ? [] : (sensorResult.data || []);
    const memory = memoryResult.data || [];
    if (memory.length > 0) {
      return json({
        ok: true,
        found: true,
        source: "verified_memory",
        memory: memory.map((item: any) => ({
          id: item.id,
          hotelId: item.hotel_id,
          equipmentId: item.equipment_id,
          area: item.area,
          category: item.category,
          symptom: item.symptom,
          errorCode: item.error_code,
          cause: item.cause,
          solution: item.solution,
          confidence: item.confidence,
          confirmationCount: item.confirmation_count,
          failureCount: item.failure_count,
          sourceLabel: item.source_label,
          lastConfirmedAt: item.last_confirmed_at,
        })),
        sensors,
        procedure: null,
        equipment: [],
        history: [],
        documents: [],
      });
    }

    const [proceduresResult, equipmentResult, issuesResult, interventionsResult, documentsResult] = await Promise.all([
      admin.from("randai_procedures").select("id,hotel_id,title,category,area,symptom,summary,keywords,steps,caution,source_label,version").eq("hotel_id", hotelId).eq("status", "approved"),
      admin.from("randai_equipment").select("id,name,category,location,description,randai_equipment_serves(served_area,note)").eq("hotel_id", hotelId).eq("active", true),
      admin.from("maintenance_issues").select("id,location,category,description,status,completion_note,completed_at,updated_at").eq("hotel_id", hotelId).order("updated_at", { ascending: false }).limit(20),
      admin.from("interventi").select("id,camera,categoria,note,stato,sezione,pezzo_nome,pezzo_sostituito,completato_il,updated_at").eq("hotel_id", hotelId).order("updated_at", { ascending: false }).limit(20),
      admin.rpc("randai_search_document_chunks", { p_hotel_id: hotelId, p_query: query, p_limit: 5 }),
    ]);
    if (proceduresResult.error) throw proceduresResult.error;
    if (equipmentResult.error) throw equipmentResult.error;

    const ranked = (proceduresResult.data || []).map((procedure: any) => ({ procedure, score: scoreProcedure(procedure, query) })).filter((entry: any) => entry.score > 0).sort((a: any, b: any) => b.score - a.score);
    const procedure = ranked[0]?.procedure;
    const documents = documentsResult.error ? [] : (documentsResult.data || []);
    if (!procedure && documents.length === 0 && sensors.length === 0) return json({ ok: true, found: false, reason: "no_approved_knowledge" });

    const queryText = normalize(query);
    const equipment = (equipmentResult.data || []).filter((item: any) => {
      const haystack = normalize([item.name, item.category, item.location, item.description].join(" "));
      return (procedure?.category && normalize(item.category) === normalize(procedure.category))
        || (procedure?.area && haystack.includes(normalize(procedure.area)))
        || queryText.split(/\s+/).some((word) => word.length > 3 && haystack.includes(word));
    });

    const historyPool = [
      ...((issuesResult.error ? [] : issuesResult.data) || []).map((item: any) => ({ ...item, __kind: "segnalazione" })),
      ...((interventionsResult.error ? [] : interventionsResult.data) || []).map((item: any) => ({ ...item, __kind: "intervento" })),
    ];
    const history = historyPool.map((item: any) => ({ item, score: scoreHistory(item, query, procedure) })).filter((entry: any) => entry.score > 0).sort((a: any, b: any) => b.score - a.score).slice(0, 3).map(({ item }: any) => ({
      id: item.id,
      kind: item.__kind,
      location: item.location || item.camera || item.sezione || "",
      category: item.category || item.categoria || "",
      text: item.completion_note || item.note || item.description || "",
      status: item.status || item.stato || "",
      date: item.completed_at || item.completato_il || item.updated_at || null,
    }));

    const source = procedure ? "approved_internal_knowledge" : documents.length > 0 ? "approved_documentation" : "live_sensor_context";
    return json({ ok: true, found: true, source, procedure: procedure ? { ...procedure, hotelId: procedure.hotel_id, sourceType: "procedura_interna", sourceLabel: procedure.source_label } : null, equipment, history, documents, memory: [], sensors });
  } catch (error) {
    console.error("randai-assistant", error instanceof Error ? error.message : "unknown");
    return json({ ok: false, error: "randai_unavailable" }, 500);
  }
});