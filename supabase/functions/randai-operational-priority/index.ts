import { createClient } from "npm:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const norm = (value: unknown) => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const HIGH_RISK = ["perdita", "acqua", "allag", "elettric", "quadro", "ascensor", "gas", "incend", "fumo", "serratura", "porta ingresso"];

function scoreIssue(issue: any, memory: any[], actor: any) {
  const reasons: string[] = [];
  const blockers: string[] = [];
  let score = issue.urgenza === "alta" ? 60 : issue.urgenza === "media" ? 35 : 18;
  if (issue.urgenza === "alta") reasons.push("urgenza alta dichiarata");
  else if (issue.urgenza === "media") reasons.push("urgenza media");

  const text = norm([issue.categoria, issue.note, issue.camera].join(" "));
  if (HIGH_RISK.some((token) => text.includes(token))) { score += 18; reasons.push("possibile impatto su sicurezza o danni"); }

  const roomState = norm(issue.stato_camera);
  if (roomState.includes("occup") || roomState.includes("ospite")) { score += 12; reasons.push("camera occupata / impatto ospite"); }
  if (roomState.includes("fuori") || roomState.includes("blocc")) { score += 16; reasons.push("camera o area bloccata"); }

  const ageHours = issue.creato_il ? Math.max(0, (Date.now() - new Date(issue.creato_il).getTime()) / 3_600_000) : 0;
  if (ageHours >= 2) { const bonus = Math.min(16, Math.floor(ageHours / 4) * 3); score += bonus; reasons.push(`aperta da ${Math.floor(ageHours)} ore`); }

  const waiting = norm(issue.attesa_da || issue.pezzo_decisione);
  if (waiting.includes("pezzo") || waiting.includes("ricambio") || waiting.includes("attesa")) { score -= 24; blockers.push("in attesa di ricambio"); }
  if (issue.tecnico_richiesto_da && !issue.tecnico_completato) {
    const futureArrival = issue.tecnico_arrivo_previsto && new Date(issue.tecnico_arrivo_previsto).getTime() > Date.now();
    score -= futureArrival ? 28 : 14;
    blockers.push(futureArrival ? "tecnico esterno già atteso" : "tecnico esterno richiesto");
  }

  const related = memory.filter((m) => norm(m.category) === norm(issue.categoria));
  const confirmations = related.reduce((sum, m) => sum + Number(m.confirmation_count || 0), 0);
  if (confirmations >= 2) { score += Math.min(10, confirmations * 2); reasons.push(`${confirmations} conferme da casi verificati simili`); }
  const failures = related.reduce((sum, m) => sum + Number(m.failure_count || 0), 0);
  if (failures >= 2) { score += 5; reasons.push("storico con ricorrenze/problematiche ripetute"); }

  const actionable = blockers.length === 0;
  if (!actionable) reasons.push("importante ma non pienamente azionabile adesso");
  const finalScore = clamp(score);
  const priorityLabel = finalScore >= 80 ? "Critica" : finalScore >= 60 ? "Alta" : finalScore >= 40 ? "Media" : "Bassa";
  const role = norm(actor?.role);
  const assignmentSuggestion = actionable && role.includes("manut") && actor?.name ? `prendila tu (${actor.name})` : actionable ? "assegnare a un manutentore disponibile" : null;

  return { id: issue.id, room: issue.camera, category: issue.categoria, title: issue.note, status: issue.stato, score: finalScore, priorityLabel, reasons, blockers, actionable, assignmentSuggestion, createdAt: issue.creato_il };
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
    if (!hotelId) return json({ ok: false, error: "hotel_required" }, 400);
    const { data: membership } = await admin.from("hotel_memberships").select("active").eq("auth_user_id", userData.user.id).eq("hotel_id", hotelId).maybeSingle();
    if (!membership?.active) return json({ ok: false, error: "forbidden" }, 403);

    const [issuesResult, memoryResult] = await Promise.all([
      admin.from("segnalazioni").select("id,hotel_id,camera,urgenza,categoria,stato,stato_camera,note,creato_il,updated_at,attesa_da,pezzo_decisione,tecnico_richiesto_da,tecnico_arrivo_previsto,tecnico_completato").eq("hotel_id", hotelId).neq("stato", "done").order("creato_il", { ascending: true }).limit(100),
      admin.from("randai_memory").select("category,confirmation_count,failure_count,last_confirmed_at").eq("hotel_id", hotelId).eq("outcome", "resolved").order("last_confirmed_at", { ascending: false }).limit(100),
    ]);
    if (issuesResult.error) throw issuesResult.error;
    if (memoryResult.error) throw memoryResult.error;

    const items = (issuesResult.data || []).map((issue) => scoreIssue(issue, memoryResult.data || [], body?.actor || {})).sort((a, b) => {
      if (a.actionable !== b.actionable) return a.actionable ? -1 : 1;
      return b.score - a.score || new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
    });
    const recommendation = items.find((item) => item.actionable) || items[0] || null;
    return json({ ok: true, recommendation, items: items.slice(0, 10), generatedAt: new Date().toISOString(), policy: "recommendation_first" });
  } catch (error) {
    console.error("randai-operational-priority", error instanceof Error ? error.message : "unknown");
    return json({ ok: false, error: "priority_unavailable" }, 500);
  }
});
