import { createClient } from "npm:@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const clean = (v: unknown, max = 1000) => String(v ?? "").trim().slice(0, max);

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function resolveDispatch(token: string) {
  const raw = clean(token, 200);
  if (!raw) return null;
  const hash = await sha256(raw);
  const { data: access, error } = await admin.from("technician_dispatch_tokens")
    .select("id,dispatch_request_id,technician_id,expires_at,opened_at,revoked_at,ended_at")
    .eq("token_hash", hash).maybeSingle();
  if (error || !access || access.revoked_at || access.ended_at) return null;
  if (!access.expires_at || new Date(access.expires_at).getTime() <= Date.now()) return null;
  const { data: request } = await admin.from("technician_dispatch_requests").select("*").eq("id", access.dispatch_request_id).maybeSingle();
  if (!request || ["rejected", "cancelled", "expired", "closed"].includes(request.status)) return null;
  if (request.technician_id !== access.technician_id) return null;
  const [{ data: tech }, { data: issue }, { data: intervention }, { data: events }] = await Promise.all([
    admin.from("external_technicians").select("id,hotel_id,name,company,active").eq("id", access.technician_id).maybeSingle(),
    admin.from("segnalazioni").select("id,hotel_id,camera,urgenza,categoria,stato,note,tecnico_arrivo_previsto,creato_il").eq("id", request.issue_id).eq("hotel_id", request.hotel_id).maybeSingle(),
    request.intervention_id ? admin.from("interventi").select("id,hotel_id,camera,categoria,note,stato,programmato_dal,programmato_al,tecnico_arrivo_previsto,creato_il").eq("id", request.intervention_id).maybeSingle() : Promise.resolve({ data: null }),
    admin.from("technician_intervention_events").select("id,event_type,note,arrival_at,actor_kind,created_at").eq("request_id", request.id).order("created_at", { ascending: true }),
  ]);
  if (!tech?.active || !issue || tech.hotel_id !== request.hotel_id || issue.hotel_id !== request.hotel_id) return null;
  return { access, request, tech, issue, intervention, events: events || [] };
}

async function touchDispatch(ctx: any) {
  const now = new Date().toISOString();
  const firstOpen = !ctx.access.opened_at;
  await admin.from("technician_dispatch_tokens").update({ opened_at: ctx.access.opened_at || now, last_used_at: now }).eq("id", ctx.access.id);
  if (firstOpen) await admin.from("technician_intervention_events").insert({ hotel_id: ctx.request.hotel_id, request_id: ctx.request.id, issue_id: ctx.issue.id, technician_id: ctx.tech.id, event_type: "opened", actor_kind: "technician" });
}

function dispatchItem(ctx: any) {
  return {
    kind: "dispatch", id: ctx.request.id, issueId: ctx.issue.id, interventionId: ctx.intervention?.id || null,
    hotelId: ctx.request.hotel_id, hotelName: ctx.request.hotel_id, room: ctx.issue.camera,
    urgency: ctx.issue.urgenza, category: ctx.issue.categoria || "Tecnico esterno", title: ctx.issue.note,
    status: ctx.request.status, expectedArrival: ctx.intervention?.tecnico_arrivo_previsto || ctx.issue.tecnico_arrivo_previsto || null,
    scheduledAt: ctx.intervention?.programmato_dal || null, reason: ctx.request.reason,
    authorizationNote: ctx.request.authorization_note || null, awaitingInternalClose: ctx.request.status === "awaiting_internal_close",
    events: ctx.events,
  };
}

async function resolveLegacy(token: string) {
  const value = clean(token, 200);
  if (!value) return null;
  const { data: row } = await admin.from("technician_access_tokens").select("auth_user_id,revoked_at").eq("token", value).maybeSingle();
  if (!row || row.revoked_at) return null;
  const { data: profile } = await admin.from("profiles").select("auth_user_id,display_name,active").eq("auth_user_id", row.auth_user_id).maybeSingle();
  if (!profile?.active) return null;
  const { data: memberships } = await admin.from("hotel_memberships").select("hotel_id,role,active").eq("auth_user_id", profile.auth_user_id).eq("active", true).eq("role", "Tecnico esterno");
  const hotels = (memberships || []).map((m: any) => m.hotel_id);
  return hotels.length ? { authUserId: profile.auth_user_id, name: profile.display_name, hotels } : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "Metodo non consentito" }, 405);
  try {
    const body = await req.json().catch(() => null);
    const action = clean(body?.action || "list", 40);
    const token = clean(body?.token, 200);
    const ctx = await resolveDispatch(token);
    if (ctx) {
      await touchDispatch(ctx);
      if (action === "list") return json({ ok: true, mode: "dispatch", technician: { name: ctx.tech.name, company: ctx.tech.company || null }, items: [dispatchItem(ctx)] });
      if (action === "set_arrival") {
        const arrival = body?.arrival_at ? new Date(String(body.arrival_at)).toISOString() : null;
        if (!arrival) return json({ ok: false, error: "Orario non valido" }, 400);
        if (ctx.intervention?.id) await admin.from("interventi").update({ tecnico_arrivo_previsto: arrival, updated_at: new Date().toISOString() }).eq("id", ctx.intervention.id);
        await admin.from("segnalazioni").update({ tecnico_arrivo_previsto: arrival }).eq("id", ctx.issue.id).eq("hotel_id", ctx.request.hotel_id);
        await admin.from("technician_intervention_events").insert({ hotel_id: ctx.request.hotel_id, request_id: ctx.request.id, issue_id: ctx.issue.id, technician_id: ctx.tech.id, event_type: "arrival_set", arrival_at: arrival, actor_kind: "technician" });
        return json({ ok: true });
      }
      if (action === "start") {
        if (ctx.request.status === "awaiting_internal_close") return json({ ok: false, error: "Intervento già dichiarato terminato" }, 409);
        await admin.from("technician_dispatch_requests").update({ status: "in_progress", updated_at: new Date().toISOString() }).eq("id", ctx.request.id);
        if (ctx.intervention?.id) await admin.from("interventi").update({ stato: "in_corso", updated_at: new Date().toISOString() }).eq("id", ctx.intervention.id);
        await admin.from("technician_intervention_events").insert({ hotel_id: ctx.request.hotel_id, request_id: ctx.request.id, issue_id: ctx.issue.id, technician_id: ctx.tech.id, event_type: "started", actor_kind: "technician" });
        return json({ ok: true });
      }
      if (action === "note") {
        const note = clean(body?.note, 1200);
        if (!note) return json({ ok: false, error: "Nota obbligatoria" }, 400);
        await admin.from("technician_intervention_events").insert({ hotel_id: ctx.request.hotel_id, request_id: ctx.request.id, issue_id: ctx.issue.id, technician_id: ctx.tech.id, event_type: "note", note, actor_kind: "technician" });
        return json({ ok: true });
      }
      if (action === "complete") {
        const note = clean(body?.note, 1200) || null;
        const now = new Date().toISOString();
        await admin.from("technician_dispatch_requests").update({ status: "awaiting_internal_close", completed_requested_at: now, updated_at: now }).eq("id", ctx.request.id);
        await admin.from("segnalazioni").update({ tecnico_completato: true, tecnico_nota: note }).eq("id", ctx.issue.id).eq("hotel_id", ctx.request.hotel_id);
        await admin.from("technician_intervention_events").insert({ hotel_id: ctx.request.hotel_id, request_id: ctx.request.id, issue_id: ctx.issue.id, technician_id: ctx.tech.id, event_type: "completion_requested", note, actor_kind: "technician" });
        return json({ ok: true, awaiting_internal_close: true });
      }
      return json({ ok: false, error: "Azione non valida" }, 400);
    }

    // Compatibility path for pre-Point-4 links. It intentionally no longer lets
    // an external technician hard-close a RandApp issue.
    const legacy = await resolveLegacy(token);
    if (!legacy) return json({ ok: false, error: "Link non valido o scaduto" }, 401);
    if (action === "list") {
      const { data: issues } = await admin.from("segnalazioni").select("id,hotel_id,camera,urgenza,categoria,stato,note,tecnico_arrivo_previsto,creato_il").eq("tecnico_id", legacy.authUserId).neq("stato", "done").order("creato_il", { ascending: false });
      return json({ ok: true, mode: "legacy", technician: { name: legacy.name }, items: (issues || []).map((row: any) => ({ kind: "issue", id: row.id, hotelId: row.hotel_id, hotelName: row.hotel_id, room: row.camera, urgency: row.urgenza, category: row.categoria, status: row.stato, title: row.note, expectedArrival: row.tecnico_arrivo_previsto, createdAt: row.creato_il })) });
    }
    const id = clean(body?.id, 120);
    const { data: issue } = await admin.from("segnalazioni").select("id,tecnico_id").eq("id", id).maybeSingle();
    if (!issue || issue.tecnico_id !== legacy.authUserId) return json({ ok: false, error: "Non autorizzato su questo elemento" }, 403);
    if (action === "set_arrival") { const arrival = body?.arrival_at ? new Date(String(body.arrival_at)).toISOString() : null; await admin.from("segnalazioni").update({ tecnico_arrivo_previsto: arrival }).eq("id", id); return json({ ok: true }); }
    if (action === "complete") { const note = clean(body?.note, 1200) || null; await admin.from("segnalazioni").update({ tecnico_completato: true, tecnico_nota: note }).eq("id", id); return json({ ok: true, awaiting_internal_close: true }); }
    return json({ ok: false, error: "Azione non valida" }, 400);
  } catch (error) {
    console.error("tech-portal", error instanceof Error ? error.message : "unknown");
    return json({ ok: false, error: "Errore temporaneo" }, 500);
  }
});
