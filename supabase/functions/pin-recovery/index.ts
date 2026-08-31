import { createClient } from "npm:@supabase/supabase-js@2";
import bcrypt from "npm:bcryptjs@2.4.3";

const url = Deno.env.get("SUPABASE_URL")!;
const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const resendKey = Deno.env.get("RESEND_API_KEY") || "";
const fromEmail = Deno.env.get("PIN_RECOVERY_FROM_EMAIL") || "";
const appBaseUrl = (Deno.env.get("PIN_RECOVERY_APP_URL") || "https://apicehotel.vercel.app").replace(/\/$/, "");
const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function sourceHash(req: Request, identity: string) {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = req.headers.get("cf-connecting-ip")?.trim() || req.headers.get("x-real-ip")?.trim() || forwarded || "unknown";
  return sha256(`${service.slice(0, 24)}|${address}|${identity}`);
}
async function consumeRate(req: Request, identity: string) {
  const key = await sourceHash(req, identity);
  const { data, error } = await admin.rpc("consume_pin_recovery_rate_limit", { p_source_hash: key, p_window_seconds: 1800, p_max_attempts: 3 });
  if (error) throw error;
  return { allowed: data === true, key };
}
async function enabledState() {
  const { data } = await admin.from("integration_settings").select("enabled").eq("key", "pin_recovery_email").maybeSingle();
  return Boolean(data?.enabled) && Boolean(resendKey) && Boolean(fromEmail);
}
async function sendRecoveryEmail(email: string, displayName: string, rawToken: string) {
  const recoveryUrl = `${appBaseUrl}/?pinRecovery=${encodeURIComponent(rawToken)}`;
  const subject = "RandApp · Recupero PIN";
  const text = `Ciao ${displayName || ""},\n\nè stato richiesto il recupero del PIN RandApp.\nApri questo link entro 15 minuti:\n${recoveryUrl}\n\nSe non hai richiesto il recupero, ignora questa email.`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: fromEmail, to: [email], subject, text }),
  });
  if (!response.ok) throw new Error(`EMAIL_${response.status}`);
  return recoveryUrl;
}
async function cleanup() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  await admin.from("pin_recovery_rate_limits").delete().lt("updated_at", cutoff);
  await admin.from("pin_recovery_requests").delete().lt("expires_at", cutoff).not("used_at", "is", null);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method === "GET") return json({ ok: true, enabled: await enabledState() });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
  const started = Date.now();
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "request");
    const enabled = await enabledState();
    if (action === "status") return json({ ok: true, enabled });
    if (!enabled) return json({ ok: true, enabled: false, status: "disabled" });

    if (action === "request") {
      const hotelId = String(body?.hotel_id || "").trim();
      const userId = String(body?.user_id || "").trim();
      if (!hotelId || !userId) return json({ ok: true });
      const rate = await consumeRate(req, `${hotelId}|${userId}`);
      if (rate.allowed) {
        const { data: profile } = await admin.from("profiles").select("auth_user_id,legacy_user_id,email,active,display_name,is_system_protected").eq("legacy_user_id", userId).maybeSingle();
        if (profile?.active && profile?.auth_user_id && profile?.email && !profile.is_system_protected) {
          const { data: membership } = await admin.from("hotel_memberships").select("active").eq("auth_user_id", profile.auth_user_id).eq("hotel_id", hotelId).maybeSingle();
          if (membership?.active) {
            const raw = crypto.randomUUID() + crypto.randomUUID();
            const tokenHash = await sha256(raw);
            await admin.from("pin_recovery_requests").update({ used_at: new Date().toISOString() }).eq("auth_user_id", profile.auth_user_id).is("used_at", null);
            const { error: insertError } = await admin.from("pin_recovery_requests").insert({ auth_user_id: profile.auth_user_id, email: String(profile.email).toLowerCase(), token_hash: tokenHash, expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(), request_ip_hash: rate.key });
            if (insertError) throw insertError;
            await sendRecoveryEmail(String(profile.email).toLowerCase(), String(profile.display_name || ""), raw);
          }
        }
      }
      await cleanup();
      const wait = Math.max(0, 300 - (Date.now() - started)); if (wait) await new Promise((r) => setTimeout(r, wait));
      return json({ ok: true, enabled: true });
    }

    if (action === "complete") {
      const token = String(body?.token || "").trim();
      const newPin = String(body?.new_pin || "").trim();
      if (token.length < 40 || !/^\d{4}$/.test(newPin)) return json({ ok: false, error: "Link non valido o PIN non valido" }, 400);
      const tokenHash = await sha256(token);
      const { data: recovery } = await admin.from("pin_recovery_requests").select("id,auth_user_id,expires_at,used_at").eq("token_hash", tokenHash).maybeSingle();
      if (!recovery || recovery.used_at || new Date(recovery.expires_at).getTime() <= Date.now()) return json({ ok: false, error: "Link non valido o scaduto" }, 400);
      const { data: profile } = await admin.from("profiles").select("active,is_system_protected").eq("auth_user_id", recovery.auth_user_id).maybeSingle();
      if (!profile?.active || profile.is_system_protected) return json({ ok: false, error: "Recupero non consentito" }, 403);
      const pinHash = await bcrypt.hash(newPin, 11);
      const now = new Date().toISOString();
      const { error: credError } = await admin.from("auth_pin_credentials").update({ pin_hash: pinHash, must_change_pin: false, failed_attempts: 0, locked_until: null, updated_at: now }).eq("auth_user_id", recovery.auth_user_id);
      if (credError) throw credError;
      await admin.from("profiles").update({ last_pin_change_at: now }).eq("auth_user_id", recovery.auth_user_id);
      await admin.from("pin_recovery_requests").update({ used_at: now }).eq("auth_user_id", recovery.auth_user_id).is("used_at", null);
      return json({ ok: true, enabled: true });
    }

    return json({ ok: false, error: "action_not_allowed" }, 400);
  } catch (error) {
    console.error("pin-recovery", error instanceof Error ? error.message : "unknown");
    const wait = Math.max(0, 300 - (Date.now() - started)); if (wait) await new Promise((r) => setTimeout(r, wait));
    return json({ ok: false, error: "Recupero PIN temporaneamente non disponibile" }, 503);
  }
});
