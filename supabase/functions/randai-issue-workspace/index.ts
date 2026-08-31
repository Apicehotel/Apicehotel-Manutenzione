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
const now = () => new Date().toISOString();
const TERMINAL = new Set(["SUCCEEDED", "FAILED", "CANCELLED"]);

function taskSummary(row: any) {
  if (!row?.state) return null;
  const task = row.state;
  const planSteps = task.plan?.steps || [];
  const completed = planSteps.filter((step: any) => task.steps?.[step.id]?.status === "SUCCEEDED").length;
  const next = planSteps.find((step: any) => task.steps?.[step.id]?.status === "PENDING");
  return {
    id: task.id,
    status: task.status,
    completedSteps: completed,
    totalSteps: planSteps.length,
    nextStepId: next?.id || null,
    nextStepTitle: next?.title || null,
    checkpoint: task.checkpoint || null,
    updatedAt: task.updatedAt || row.updated_at || null,
    completedAt: task.completedAt || null,
    procedureId: task.metadata?.procedureId || null,
  };
}

async function getIssue(hotelId: string, issueId: string) {
  const { data, error } = await admin.from("maintenance_issues")
    .select("id,hotel_id,location,category,priority,status,description,completion_note,completed_at,updated_at")
    .eq("hotel_id", hotelId).eq("id", issueId).maybeSingle();
  if (error) throw error;
  return data;
}

async function getActiveTask(hotelId: string, issueId: string) {
  const { data, error } = await admin.from("randai_tasks")
    .select("id,status,state,revision,updated_at")
    .eq("hotel_id", hotelId).eq("source_type", "issue").eq("source_id", issueId)
    .not("status", "in", '(SUCCEEDED,FAILED,CANCELLED)')
    .order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

async function getTask(hotelId: string, issueId: string, taskId: string) {
  const { data, error } = await admin.from("randai_tasks")
    .select("id,status,state,revision,updated_at")
    .eq("hotel_id", hotelId).eq("source_type", "issue").eq("source_id", issueId).eq("id", taskId).maybeSingle();
  if (error) throw error;
  return data;
}

async function getApprovedProcedure(hotelId: string, procedureId: string | null) {
  if (!procedureId) return null;
  const { data, error } = await admin.from("randai_procedures")
    .select("id,title,summary,steps,caution,source_label,version")
    .eq("hotel_id", hotelId).eq("id", procedureId).eq("status", "approved").maybeSingle();
  if (error) throw error;
  return data;
}

async function syncCompletedIssue(row: any, issue: any) {
  if (!row?.state || issue?.status !== "done" || TERMINAL.has(row.status)) return row;
  const state = structuredClone(row.state);
  const changedAt = now();
  state.status = "SUCCEEDED";
  state.completedAt = issue.completed_at || changedAt;
  state.updatedAt = changedAt;
  state.checkpoint = { kind: "COMPLETED", at: changedAt, reason: "ISSUE_COMPLETED" };
  state.events = [...(state.events || []), { type: "CHECKPOINT", ...state.checkpoint }];
  const { data, error } = await admin.from("randai_tasks").update({
    status: "SUCCEEDED", state, checkpoint: state.checkpoint, completed_at: state.completedAt,
    updated_at: changedAt, revision: Number(row.revision || 0) + 1,
  }).eq("id", row.id).eq("revision", row.revision).select("id,status,state,revision,updated_at").maybeSingle();
  if (error) throw error;
  return data || row;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
  try {
    const client = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("authorization") || "" } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData.user) return json({ ok: false, error: "unauthorized" }, 401);
    const body = await req.json().catch(() => ({}));
    const operation = String(body?.operation || "summary");
    const hotelId = String(body?.hotel_id || "").trim();
    const issueId = String(body?.issue_id || "").trim();
    if (!hotelId || !issueId) return json({ ok: false, error: "hotel_and_issue_required" }, 400);

    const { data: membership } = await admin.from("hotel_memberships").select("active").eq("auth_user_id", userData.user.id).eq("hotel_id", hotelId).maybeSingle();
    if (!membership?.active) return json({ ok: false, error: "forbidden" }, 403);
    const issue = await getIssue(hotelId, issueId);
    if (!issue) return json({ ok: false, error: "issue_not_found" }, 404);

    if (operation === "summary") {
      let task = await getActiveTask(hotelId, issueId);
      task = await syncCompletedIssue(task, issue);
      return json({ ok: true, task: taskSummary(task) });
    }

    if (operation === "start") {
      const existing = await getActiveTask(hotelId, issueId);
      if (existing) return json({ ok: true, reused: true, task: taskSummary(existing) });
      const procedure = await getApprovedProcedure(hotelId, body?.procedure_id ? String(body.procedure_id) : null);
      if (!procedure || !Array.isArray(procedure.steps) || procedure.steps.length === 0) return json({ ok: false, error: "verified_procedure_required" }, 409);

      const createdAt = now();
      const taskId = `RND-ISSUE-${crypto.randomUUID()}`;
      const steps = procedure.steps.slice(0, 20).map((title: unknown, index: number) => ({ id: `check-${index + 1}`, title: String(title).slice(0, 500), dependsOn: index ? [`check-${index}`] : [], strategies: [{ toolId: "human.checkpoint", input: { procedureId: procedure.id, step: index + 1 } }], verification: { verifierId: "human_confirmation" } }));
      const state: any = {
        id: taskId,
        objective: `Gestire segnalazione ${issue.location || issue.id}: ${issue.description || issue.category || "manutenzione"}`,
        metadata: { hotelId, sourceType: "issue", sourceId: issueId, procedureId: procedure.id, procedureTitle: procedure.title, actorUserId: userData.user.id },
        plan: { id: `issue-plan-${issueId}`, objective: issue.description || issue.category || "Gestire segnalazione", successCriteria: ["Controlli eseguiti e confermati dal manutentore", "Segnalazione chiusa solo dopo verifica reale"], steps },
        status: "PAUSED",
        steps: Object.fromEntries(steps.map((step: any) => [step.id, { id: step.id, status: "PENDING", attempts: 0, strategyIndex: 0, result: null, verification: null, startedAt: null, completedAt: null }])),
        decisions: [], errors: [], artifacts: [], events: [], recoveryHistory: [],
        checkpoint: { kind: "PLAN_READY", at: createdAt, source: "approved_procedure", procedureId: procedure.id },
        createdAt, updatedAt: createdAt, completedAt: null, revision: 1,
      };
      state.events.push({ type: "CHECKPOINT", ...state.checkpoint });
      const row = { id: taskId, hotel_id: hotelId, objective: state.objective, status: state.status, plan: state.plan, state, checkpoint: state.checkpoint, revision: 1, source_type: "issue", source_id: issueId, updated_at: createdAt };
      const { data, error } = await admin.from("randai_tasks").insert(row).select("id,status,state,revision,updated_at").maybeSingle();
      if (error) {
        if (error.code === "23505") {
          const concurrent = await getActiveTask(hotelId, issueId);
          return json({ ok: true, reused: true, task: taskSummary(concurrent) });
        }
        throw error;
      }
      return json({ ok: true, reused: false, task: taskSummary(data) });
    }

    if (operation === "advance") {
      const taskId = String(body?.task_id || "").trim();
      if (!taskId) return json({ ok: false, error: "task_required" }, 400);
      const row = await getTask(hotelId, issueId, taskId);
      if (!row?.state || TERMINAL.has(row.status)) return json({ ok: false, error: "active_task_not_found" }, 404);
      const state = structuredClone(row.state);
      const next = (state.plan?.steps || []).find((step: any) => state.steps?.[step.id]?.status === "PENDING");
      if (!next) return json({ ok: true, task: taskSummary(row) });
      const changedAt = now();
      state.steps[next.id] = { ...state.steps[next.id], status: "SUCCEEDED", attempts: Number(state.steps[next.id]?.attempts || 0) + 1, startedAt: state.steps[next.id]?.startedAt || changedAt, completedAt: changedAt, result: { status: "SUCCESS", data: { confirmedBy: userData.user.id, note: String(body?.note || "").slice(0, 500) } }, verification: { ok: true, method: "human_confirmation", userId: userData.user.id, at: changedAt } };
      const pending = (state.plan?.steps || []).some((step: any) => state.steps?.[step.id]?.status === "PENDING");
      state.status = pending ? "PAUSED" : (issue.status === "done" ? "SUCCEEDED" : "VERIFYING");
      state.updatedAt = changedAt;
      if (state.status === "SUCCEEDED") state.completedAt = issue.completed_at || changedAt;
      state.checkpoint = { kind: pending ? "STEP_COMPLETE" : (state.status === "SUCCEEDED" ? "COMPLETED" : "VERIFICATION_PASS"), at: changedAt, stepId: next.id, verification: "human_confirmation" };
      state.events = [...(state.events || []), { type: "CHECKPOINT", ...state.checkpoint }];
      const nextRevision = Number(row.revision || 0) + 1;
      const { data, error } = await admin.from("randai_tasks").update({ status: state.status, state: { ...state, revision: nextRevision }, checkpoint: state.checkpoint, completed_at: state.completedAt || null, updated_at: changedAt, revision: nextRevision }).eq("id", row.id).eq("revision", row.revision).select("id,status,state,revision,updated_at").maybeSingle();
      if (error) throw error;
      if (!data) return json({ ok: false, error: "task_revision_conflict" }, 409);
      return json({ ok: true, task: taskSummary(data) });
    }

    if (operation === "completion_summary") {
      const taskId = String(body?.task_id || "").trim();
      const row = await getTask(hotelId, issueId, taskId);
      if (!row?.state) return json({ ok: false, error: "task_not_found" }, 404);
      const state = row.state;
      const done = (state.plan?.steps || []).filter((step: any) => state.steps?.[step.id]?.status === "SUCCEEDED").map((step: any) => step.title);
      const lines = [
        `RandAI · ${state.metadata?.procedureTitle || "percorso manutenzione"}`,
        `Problema: ${issue.description || issue.category || "segnalazione manutenzione"}`,
        `Ubicazione: ${issue.location || "non indicata"}`,
        done.length ? `Verifiche eseguite: ${done.join("; ")}` : "Verifiche eseguite: nessun passaggio ancora confermato",
        "Esito finale: da completare e confermare dal manutentore.",
      ];
      return json({ ok: true, summary: lines.join("\n") });
    }

    return json({ ok: false, error: "unknown_operation" }, 400);
  } catch (error) {
    console.error("randai-issue-workspace", error instanceof Error ? error.message : "unknown");
    return json({ ok: false, error: "randai_issue_workspace_unavailable" }, 500);
  }
});
