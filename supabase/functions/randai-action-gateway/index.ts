import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildIssuePreview,
  buildIssuePatch,
  sanitizeActionRequest,
  summarizeAction,
  validateIssueTransition,
  verifyAppliedIssueAction,
} from "../_shared/randai-action-policy.js";

const url = Deno.env.get("SUPABASE_URL")!;
const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
});
const nowIso = () => new Date().toISOString();
const clean = (value: unknown, max = 500) => String(value ?? "").trim().slice(0, max);

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function authContext(req: Request, hotelId: string) {
  const client = createClient(url, anon, {
    global: { headers: { Authorization: req.headers.get("authorization") || "" } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) return { error: json({ ok: false, error: "unauthorized" }, 401) };

  const { data: membership, error: membershipError } = await admin
    .from("hotel_memberships")
    .select("role,active")
    .eq("auth_user_id", userData.user.id)
    .eq("hotel_id", hotelId)
    .maybeSingle();
  if (membershipError) throw membershipError;
  if (!membership?.active) return { error: json({ ok: false, error: "forbidden" }, 403) };

  const { data: profile } = await admin
    .from("profiles")
    .select("display_name,active")
    .eq("auth_user_id", userData.user.id)
    .maybeSingle();
  if (profile && profile.active === false) return { error: json({ ok: false, error: "profile_disabled" }, 403) };

  return {
    userId: userData.user.id,
    role: membership.role || "",
    displayName: profile?.display_name || userData.user.email || "Utente RandApp",
  };
}

async function gatewayEnabled(hotelId: string) {
  const { data, error } = await admin
    .from("randai_action_gateway_settings")
    .select("enabled,auto_execute_low_risk")
    .eq("hotel_id", hotelId)
    .maybeSingle();
  if (error) throw error;
  return data || { enabled: false, auto_execute_low_risk: false };
}

async function allowed(role: string, module: string, action: string) {
  if (!role) return false;
  const { data, error } = await admin
    .from("role_permissions")
    .select("allowed")
    .eq("role", role)
    .eq("module", module)
    .eq("action", action)
    .maybeSingle();
  if (error) throw error;
  return data?.allowed === true;
}

async function readIssue(hotelId: string, resourceId: string) {
  const { data, error } = await admin
    .from("segnalazioni")
    .select("id,hotel_id,camera,urgenza,categoria,stato,note,pezzo_nome,nota_completamento,completato_da,completato_il,updated_at")
    .eq("hotel_id", hotelId)
    .eq("id", resourceId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

function contextMatches(body: any, hotelId: string, resourceId: string) {
  const context = body?.context;
  if (!context) return true;
  const contextHotel = clean(context.hotelId || context.hotel_id, 80);
  const contextResource = clean(context.resource?.id, 120);
  if (contextHotel && contextHotel !== hotelId) return false;
  if (contextResource && contextResource !== resourceId) return false;
  return true;
}

async function findExistingApproval(idempotencyKey: string) {
  const { data, error } = await admin
    .from("randai_action_approvals")
    .select("*")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

function approvalPayload(action: any, preview: any) {
  return {
    action: { type: action.type, resourceId: action.resourceId, input: action.input },
    risk: action.definition.risk,
    permission: action.definition.permission,
    before: preview.before,
    requested: preview.after,
    summary: summarizeAction(action),
  };
}

async function createApproval({ hotelId, actor, action, preview, idempotencyKey }: any) {
  const existing = await findExistingApproval(idempotencyKey);
  const requestedAt = nowIso();
  const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
  const payload = approvalPayload(action, preview);

  if (existing) {
    const stillPending = existing.status === "PENDING" && existing.expires_at && new Date(existing.expires_at).getTime() > Date.now();
    if (stillPending) return existing;
    if (existing.status === "APPROVED" && existing.payload?.execution?.status === "EXECUTED") return existing;

    const { data, error } = await admin.from("randai_action_approvals").update({
      status: "PENDING",
      requested_at: requestedAt,
      decided_at: null,
      expires_at: expiresAt,
      decided_by: null,
      reason: "ACTION_GATEWAY_CONFIRMATION_REQUIRED",
      payload,
      hotel_id: hotelId,
      requested_by_auth_user_id: actor.userId,
      action_type: action.type,
      resource_type: action.definition.resourceType,
      resource_id: action.resourceId,
    }).eq("id", existing.id).select("*").single();
    if (error) throw error;
    return data;
  }

  const row = {
    id: `APR-${crypto.randomUUID()}`,
    identity: idempotencyKey,
    tool_id: action.type,
    task_id: null,
    step_id: null,
    status: "PENDING",
    requested_at: requestedAt,
    decided_at: null,
    expires_at: expiresAt,
    decided_by: null,
    reason: "ACTION_GATEWAY_CONFIRMATION_REQUIRED",
    payload,
    hotel_id: hotelId,
    requested_by_auth_user_id: actor.userId,
    action_type: action.type,
    resource_type: action.definition.resourceType,
    resource_id: action.resourceId,
    idempotency_key: idempotencyKey,
  };
  const { data, error } = await admin.from("randai_action_approvals").insert(row).select("*").single();
  if (error?.code === "23505") return await findExistingApproval(idempotencyKey);
  if (error) throw error;
  return data;
}

async function writeAudit(entry: any) {
  const { error } = await admin.from("randai_action_audit").insert(entry);
  if (error) {
    console.error("randai_action_audit", error.message);
    return false;
  }
  return true;
}

async function prepare(req: Request, body: any) {
  const hotelId = clean(body?.hotel_id, 80);
  const action = sanitizeActionRequest(body?.action);
  if (!hotelId || !action) return json({ ok: false, error: "invalid_action_request" }, 400);
  if (!contextMatches(body, hotelId, action.resourceId)) return json({ ok: false, error: "context_mismatch" }, 400);

  const actor = await authContext(req, hotelId);
  if ((actor as any).error) return (actor as any).error;
  const settings = await gatewayEnabled(hotelId);
  if (!settings.enabled) return json({ ok: false, error: "action_gateway_disabled" }, 423);
  if (!await allowed((actor as any).role, action.definition.module, action.definition.permission)) {
    return json({ ok: false, error: "permission_denied", required_permission: action.definition.permission }, 403);
  }

  const issue = await readIssue(hotelId, action.resourceId);
  if (!issue) return json({ ok: false, error: "resource_not_found" }, 404);
  const transition = validateIssueTransition(issue, action);
  if (!transition.ok) return json({ ok: false, error: transition.reason }, 409);

  const previewTime = nowIso();
  const preview = buildIssuePreview(issue, action, (actor as any).displayName, previewTime);
  const identityMaterial = JSON.stringify({
    v: 1,
    actor: (actor as any).userId,
    hotelId,
    type: action.type,
    resourceId: action.resourceId,
    input: action.input,
    expectedUpdatedAt: issue.updated_at,
  });
  const idempotencyKey = await sha256(identityMaterial);
  const approval = await createApproval({ hotelId, actor, action, preview, idempotencyKey });

  return json({
    ok: true,
    operation: "prepared",
    plan: {
      action: action.type,
      resource_type: action.definition.resourceType,
      resource_id: action.resourceId,
      risk: action.definition.risk,
      permission: action.definition.permission,
      approval_required: true,
      approval_id: approval.id,
      expires_at: approval.expires_at,
      idempotency_key: idempotencyKey,
      summary: summarizeAction(action),
      before: preview.before,
      after: preview.after,
    },
  });
}

async function execute(req: Request, body: any) {
  const hotelId = clean(body?.hotel_id, 80);
  const approvalId = clean(body?.approval_id, 160);
  if (!hotelId || !approvalId) return json({ ok: false, error: "approval_required" }, 400);

  const actor = await authContext(req, hotelId);
  if ((actor as any).error) return (actor as any).error;
  const settings = await gatewayEnabled(hotelId);
  if (!settings.enabled) return json({ ok: false, error: "action_gateway_disabled" }, 423);

  const { data: approval, error: approvalError } = await admin
    .from("randai_action_approvals")
    .select("*")
    .eq("id", approvalId)
    .maybeSingle();
  if (approvalError) throw approvalError;
  if (!approval || approval.hotel_id !== hotelId) return json({ ok: false, error: "approval_not_found" }, 404);
  if (approval.requested_by_auth_user_id !== (actor as any).userId) return json({ ok: false, error: "approval_actor_mismatch" }, 403);

  if (approval.status === "APPROVED" && approval.payload?.execution?.status === "EXECUTED") {
    return json({ ok: true, operation: "executed", replayed: true, verified: true, result: approval.payload.execution.after });
  }
  if (approval.expires_at && new Date(approval.expires_at).getTime() <= Date.now()) {
    await admin.from("randai_action_approvals").update({ status: "EXPIRED", decided_at: nowIso(), decided_by: (actor as any).userId }).eq("id", approval.id);
    return json({ ok: false, error: "approval_expired" }, 409);
  }
  if (approval.status === "REJECTED") return json({ ok: false, error: "approval_rejected" }, 409);
  if (approval.status !== "PENDING") return json({ ok: false, error: "approval_not_pending" }, 409);

  const action = sanitizeActionRequest({
    type: approval.payload?.action?.type || approval.action_type,
    resource_id: approval.payload?.action?.resourceId || approval.resource_id,
    input: approval.payload?.action?.input || {},
  });
  if (!action) return json({ ok: false, error: "invalid_approval_payload" }, 400);
  if (!await allowed((actor as any).role, action.definition.module, action.definition.permission)) {
    return json({ ok: false, error: "permission_denied", required_permission: action.definition.permission }, 403);
  }

  const { data: priorExecution } = await admin
    .from("randai_action_audit")
    .select("id,after_state,executed_at")
    .eq("idempotency_key", approval.idempotency_key)
    .eq("status", "EXECUTED")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (priorExecution) return json({ ok: true, operation: "executed", replayed: true, verified: true, result: priorExecution.after_state });

  const issue = await readIssue(hotelId, action.resourceId);
  if (!issue) return json({ ok: false, error: "resource_not_found" }, 404);
  const expectedUpdatedAt = approval.payload?.before?.updated_at;
  if (!expectedUpdatedAt || issue.updated_at !== expectedUpdatedAt) {
    await writeAudit({
      hotel_id: hotelId,
      actor_auth_user_id: (actor as any).userId,
      actor_role: (actor as any).role,
      action_type: action.type,
      resource_type: action.definition.resourceType,
      resource_id: action.resourceId,
      risk: action.definition.risk,
      approval_id: approval.id,
      idempotency_key: approval.idempotency_key,
      status: "FAILED",
      before_state: issue,
      requested_state: approval.payload?.requested || null,
      after_state: null,
      reason: "Resource changed after approval preview",
      error_code: "STALE_RESOURCE",
      executed_at: nowIso(),
    });
    return json({ ok: false, error: "stale_resource" }, 409);
  }

  const transition = validateIssueTransition(issue, action);
  if (!transition.ok) return json({ ok: false, error: transition.reason }, 409);
  const patch = buildIssuePatch(action, (actor as any).displayName, nowIso());
  const { data: updated, error: updateError } = await admin
    .from("segnalazioni")
    .update(patch)
    .eq("hotel_id", hotelId)
    .eq("id", action.resourceId)
    .eq("updated_at", expectedUpdatedAt)
    .select("id,hotel_id,camera,urgenza,categoria,stato,note,pezzo_nome,nota_completamento,completato_da,completato_il,updated_at")
    .maybeSingle();

  if (updateError || !updated) {
    await writeAudit({
      hotel_id: hotelId,
      actor_auth_user_id: (actor as any).userId,
      actor_role: (actor as any).role,
      action_type: action.type,
      resource_type: action.definition.resourceType,
      resource_id: action.resourceId,
      risk: action.definition.risk,
      approval_id: approval.id,
      idempotency_key: approval.idempotency_key,
      status: "FAILED",
      before_state: issue,
      requested_state: approval.payload?.requested || patch,
      after_state: null,
      reason: updateError?.message || "Update did not match expected version",
      error_code: updateError?.code || "UPDATE_FAILED",
      executed_at: nowIso(),
    });
    return json({ ok: false, error: "action_execution_failed" }, 409);
  }

  const verified = await readIssue(hotelId, action.resourceId);
  if (!verifyAppliedIssueAction(verified, action)) {
    await writeAudit({
      hotel_id: hotelId,
      actor_auth_user_id: (actor as any).userId,
      actor_role: (actor as any).role,
      action_type: action.type,
      resource_type: action.definition.resourceType,
      resource_id: action.resourceId,
      risk: action.definition.risk,
      approval_id: approval.id,
      idempotency_key: approval.idempotency_key,
      status: "FAILED",
      before_state: issue,
      requested_state: approval.payload?.requested || patch,
      after_state: verified,
      reason: "Post-write verification failed",
      error_code: "VERIFICATION_FAILED",
      executed_at: nowIso(),
    });
    return json({ ok: false, error: "verification_failed" }, 500);
  }

  const executedAt = nowIso();
  const executionPayload = {
    ...approval.payload,
    execution: { status: "EXECUTED", after: verified, executedAt },
  };
  const { error: approvalUpdateError } = await admin.from("randai_action_approvals").update({
    status: "APPROVED",
    decided_at: executedAt,
    decided_by: (actor as any).userId,
    reason: "USER_CONFIRMED_AND_EXECUTED",
    payload: executionPayload,
  }).eq("id", approval.id);
  if (approvalUpdateError) {
    console.error("randai_action_approval_finalize", approvalUpdateError.message);
    return json({ ok: false, error: "approval_finalize_failed", action_applied: true, verified: true }, 500);
  }

  const auditRecorded = await writeAudit({
    hotel_id: hotelId,
    actor_auth_user_id: (actor as any).userId,
    actor_role: (actor as any).role,
    action_type: action.type,
    resource_type: action.definition.resourceType,
    resource_id: action.resourceId,
    risk: action.definition.risk,
    approval_id: approval.id,
    idempotency_key: approval.idempotency_key,
    status: "EXECUTED",
    before_state: issue,
    requested_state: approval.payload?.requested || patch,
    after_state: verified,
    reason: "USER_CONFIRMED",
    error_code: null,
    executed_at: executedAt,
  });

  return json({ ok: true, operation: "executed", replayed: false, verified: true, audit_recorded: auditRecorded, result: verified });
}

async function reject(req: Request, body: any) {
  const hotelId = clean(body?.hotel_id, 80);
  const approvalId = clean(body?.approval_id, 160);
  if (!hotelId || !approvalId) return json({ ok: false, error: "approval_required" }, 400);
  const actor = await authContext(req, hotelId);
  if ((actor as any).error) return (actor as any).error;

  const { data: approval, error } = await admin.from("randai_action_approvals").select("*").eq("id", approvalId).maybeSingle();
  if (error) throw error;
  if (!approval || approval.hotel_id !== hotelId || approval.requested_by_auth_user_id !== (actor as any).userId) {
    return json({ ok: false, error: "approval_not_found" }, 404);
  }
  if (approval.status !== "PENDING") return json({ ok: true, operation: "rejected", status: approval.status });
  const decidedAt = nowIso();
  await admin.from("randai_action_approvals").update({ status: "REJECTED", decided_at: decidedAt, decided_by: (actor as any).userId, reason: "USER_REJECTED" }).eq("id", approval.id);
  await writeAudit({
    hotel_id: hotelId,
    actor_auth_user_id: (actor as any).userId,
    actor_role: (actor as any).role,
    action_type: approval.action_type || approval.tool_id,
    resource_type: approval.resource_type || "issue",
    resource_id: approval.resource_id || "unknown",
    risk: approval.payload?.risk || "MEDIUM",
    approval_id: approval.id,
    idempotency_key: approval.idempotency_key || approval.identity,
    status: "REJECTED",
    before_state: approval.payload?.before || null,
    requested_state: approval.payload?.requested || null,
    after_state: null,
    reason: "USER_REJECTED",
    error_code: null,
    executed_at: decidedAt,
  });
  return json({ ok: true, operation: "rejected" });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const operation = clean(body?.operation, 40);
    if (operation === "prepare") return await prepare(req, body);
    if (operation === "execute") return await execute(req, body);
    if (operation === "reject") return await reject(req, body);
    return json({ ok: false, error: "unsupported_operation" }, 400);
  } catch (error) {
    console.error("randai-action-gateway", error instanceof Error ? error.message : "unknown");
    return json({ ok: false, error: "action_gateway_unavailable" }, 500);
  }
});
