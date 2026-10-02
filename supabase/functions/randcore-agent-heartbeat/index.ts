import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "npm:postgres@3.4.7";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@6.1.0";

const GITHUB_ISSUER = "https://token.actions.githubusercontent.com";
const GITHUB_JWKS = createRemoteJWKSet(new URL("https://token.actions.githubusercontent.com/.well-known/jwks"));
const EXPECTED_REPO = "Apicehotel/Apicehotel-Manutenzione";
const EXPECTED_AUD = "randcore-heartbeat";
const ALLOWED_AGENTS = new Set(["randai","randbrain","randcore","randmind","randradar","randresearch","randsecure","randtest","randops","randui"]);
const ALLOWED_STATUS = new Set(["RUNNING","WAITING_APPROVAL","ERROR","OFFLINE","IDLE"]);
const DB_URL = Deno.env.get("SUPABASE_DB_URL")!;
const sql = postgres(DB_URL, { prepare:false, max:3, idle_timeout:20, connect_timeout:10 });

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status:405 });
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return new Response("Missing bearer token", { status:401 });

  let claims:any;
  try {
    const verified = await jwtVerify(token, GITHUB_JWKS, { issuer:GITHUB_ISSUER, audience:EXPECTED_AUD });
    claims = verified.payload;
  } catch (error) {
    console.error("GitHub OIDC verification failed", error);
    return new Response("Unauthorized or invalid heartbeat", { status:401 });
  }
  if (claims.repository !== EXPECTED_REPO) return new Response("Repository not allowed", { status:403 });

  let body:any;
  try { body = await req.json(); } catch { return new Response("Invalid JSON", { status:400 }); }
  const agentId = String(body.agentId || "").trim().toLowerCase();
  const status = String(body.status || "IDLE").toUpperCase();
  if (!ALLOWED_AGENTS.has(agentId)) return new Response("Unknown agent", { status:400 });
  if (!ALLOWED_STATUS.has(status)) return new Response("Invalid status", { status:400 });

  try {
    const current = await sql`select desired_state from public.randcore_agent_runtime where agent_id=${agentId} limit 1`;
    const desiredState = current[0]?.desired_state || "RUNNING";
    const metadata = {
      ...(body.metadata || {}), source:"github-oidc", repository:claims.repository,
      workflow:claims.workflow || null, ref:claims.ref || null, sha:claims.sha || null,
      actor:claims.actor || null, run_id:claims.run_id || null,
    };
    const taskId = status === "IDLE" ? null : (body.taskId || null);
    const rows = await sql`
      insert into public.randcore_agent_runtime(
        agent_id,status,heartbeat_at,task_id,activity,detail,hotel_id,metadata,updated_at
      ) values(
        ${agentId},${status},now(),${taskId},${body.activity || null},${body.detail || null},
        ${body.hotelId || null},${JSON.stringify(metadata)}::jsonb,now()
      )
      on conflict(agent_id) do update set
        status=excluded.status, heartbeat_at=excluded.heartbeat_at, task_id=excluded.task_id,
        activity=excluded.activity, detail=excluded.detail, hotel_id=excluded.hotel_id,
        metadata=excluded.metadata, updated_at=excluded.updated_at
      returning heartbeat_at
    `;
    return Response.json({
      ok:true, agentId, desiredState, mayStartNewTask:desiredState !== "PAUSED",
      heartbeatAt:rows[0]?.heartbeat_at || new Date().toISOString(),
    });
  } catch (error) {
    console.error("Heartbeat database failure", error);
    return new Response("Heartbeat storage unavailable", { status:500 });
  }
});