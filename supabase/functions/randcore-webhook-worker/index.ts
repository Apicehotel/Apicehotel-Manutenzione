import { createClient } from "npm:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 20;
const TIMEOUT_MS = 10_000;
const RETRY_DELAYS_MS = [30_000, 120_000, 600_000, 1_800_000];

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json", "cache-control": "no-store" },
});

async function secret(key: string) {
  const { data } = await admin.from("edge_function_secrets").select("value").eq("key", key).maybeSingle();
  return data?.value ? String(data.value) : null;
}

async function sign(secretValue: string, body: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secretValue), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return `sha256=${Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function retryableStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

async function deliver(row: any, secretValue: string) {
  const body = JSON.stringify({
    id: row.event_id,
    type: row.event_type,
    aggregate: { type: row.aggregate_type, id: row.aggregate_id },
    hotel_id: row.hotel_id,
    operation: row.operation,
    occurred_at: row.occurred_at,
    source: row.source,
    correlation_id: row.correlation_id,
    idempotency_key: row.idempotency_key,
    payload: row.payload ?? {},
  });
  const signature = await sign(secretValue, body);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(row.endpoint_url, {
      method: "POST",
      body,
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "user-agent": "RandCore-Webhook-Worker/1.0",
        "x-rand-event-id": row.event_id,
        "x-rand-event-type": row.event_type,
        "x-rand-signature": signature,
        "idempotency-key": row.idempotency_key,
      },
    });
    return { ok: response.ok, retryable: retryableStatus(response.status), error: response.ok ? null : `http_${response.status}` };
  } catch (error) {
    return { ok: false, retryable: true, error: error instanceof Error ? error.name : "network_error" };
  } finally {
    clearTimeout(timer);
  }
}

async function finish(row: any, outcome: string, error: string | null) {
  const delay = RETRY_DELAYS_MS[Math.min(Math.max(row.attempts - 1, 0), RETRY_DELAYS_MS.length - 1)] ?? RETRY_DELAYS_MS.at(-1)!;
  const next = new Date(Date.now() + delay).toISOString();
  return admin.rpc("rand_finish_webhook_delivery", {
    p_delivery_id: row.delivery_id,
    p_worker_id: row.worker_id,
    p_outcome: outcome,
    p_error: error,
    p_next_attempt_at: outcome === "retry" ? next : null,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
  const expected = await secret("reminder_cron_secret");
  if (!expected || req.headers.get("x-cron-secret") !== expected) return json({ ok: false, error: "forbidden" }, 403);

  const workerId = crypto.randomUUID();
  const { data: rows, error: claimError } = await admin.rpc("rand_claim_webhook_deliveries", { p_limit: BATCH_SIZE, p_worker_id: workerId });
  if (claimError) return json({ ok: false, error: "claim_failed" }, 500);

  let delivered = 0;
  let retried = 0;
  let deadLetter = 0;
  for (const row of rows ?? []) {
    const secretValue = await secret(row.secret_ref);
    if (!secretValue) {
      await finish(row, "dead_letter", "secret_not_configured");
      deadLetter++;
      continue;
    }
    const result = await deliver(row, secretValue);
    if (result.ok) {
      await finish(row, "delivered", null);
      delivered++;
    } else if (result.retryable && row.attempts < MAX_ATTEMPTS) {
      await finish(row, "retry", result.error);
      retried++;
    } else {
      await finish(row, "dead_letter", result.error);
      deadLetter++;
    }
  }

  return json({ ok: true, claimed: rows?.length ?? 0, delivered, retried, dead_letter: deadLetter });
});
