import { createClient } from "npm:@supabase/supabase-js@2";
import bcrypt from "npm:bcryptjs@2.4.3";

const URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(URL, SERVICE, { auth: { persistSession:false, autoRefreshToken:false } });
const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"} });
const ALL_HOTELS = ["hotelgio","chocohotel","brigantino"];
const MAX_FAILURES = 5;
const LOCK_MS = 10 * 60 * 1000;

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2,"0")).join("");
}

async function sourceHash(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = req.headers.get("cf-connecting-ip")?.trim() || req.headers.get("x-real-ip")?.trim() || forwarded || "unknown";
  const ua = req.headers.get("user-agent") || "unknown";
  return sha256(`${SERVICE.slice(0,24)}|${address}|${ua.slice(0,120)}`);
}

async function throttleState(req: Request) {
  const key = await sourceHash(req);
  const { data, error } = await admin.from("admin_auth_attempts").select("failed_attempts,locked_until").eq("source_hash", key).maybeSingle();
  if (error) throw error;
  if (data?.locked_until && new Date(data.locked_until).getTime() > Date.now()) return { key, locked: true, failures: Number(data.failed_attempts || 0) };
  return { key, locked: false, failures: Number(data?.failed_attempts || 0) };
}

async function recordFailure(key: string, previous: number) {
  const failures = previous + 1;
  const locked = failures >= MAX_FAILURES;
  const row = {
    source_hash: key,
    failed_attempts: locked ? 0 : failures,
    locked_until: locked ? new Date(Date.now() + LOCK_MS).toISOString() : null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await admin.from("admin_auth_attempts").upsert(row, { onConflict:"source_hash" });
  if (error) throw error;
  await new Promise((resolve) => setTimeout(resolve, Math.min(1500, 250 * failures)));
  return locked;
}

async function clearFailures(key: string) {
  await admin.from("admin_auth_attempts").delete().eq("source_hash", key);
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  await admin.from("admin_auth_attempts").delete().lt("updated_at", cutoff);
}

async function authenticatedUser(req: Request) {
  const token = req.headers.get("authorization") || "";
  const client = createClient(URL, ANON, { global:{ headers:{ Authorization:token } }, auth:{ persistSession:false, autoRefreshToken:false } });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error("UNAUTHORIZED");
  return data.user.id;
}

async function requireProtectedAdmin(req: Request) {
  const uid = await authenticatedUser(req);
  const { data:profile } = await admin.from("profiles").select("active,is_system_protected").eq("auth_user_id",uid).maybeSingle();
  if (!profile?.active || !profile.is_system_protected) throw new Error("FORBIDDEN");
  const { data:memberships, error } = await admin.from("hotel_memberships").select("hotel_id,role,active,can_access_admin").eq("auth_user_id",uid);
  if (error) throw error;
  const allowed = new Set((memberships || []).filter((m:any) => m.active && (m.role === "admin" || m.can_access_admin)).map((m:any) => m.hotel_id));
  if (!ALL_HOTELS.every((hotel) => allowed.has(hotel))) throw new Error("FORBIDDEN");
  return uid;
}

async function ensureRandagio() {
  const { data:legacy, error:legacyError } = await admin.from("utenti").select("id,email,telefono,phone_country_code").eq("nome","Randagio").eq("is_system_protected",true).single();
  if (legacyError || !legacy) throw legacyError || new Error("Admin protetto non configurato");
  const { data:existingProfile } = await admin.from("profiles").select("auth_user_id").eq("legacy_user_id",legacy.id).maybeSingle();
  let authUserId = existingProfile?.auth_user_id as string | undefined;
  const internalEmail = `system-randagio-${legacy.id}@auth.apicehotel.invalid`;
  if (!authUserId) {
    const password = crypto.randomUUID() + crypto.randomUUID();
    const { data:created, error:createError } = await admin.auth.admin.createUser({ email:internalEmail, password, email_confirm:true, user_metadata:{legacy_user_id:legacy.id,display_name:"Randagio",system_protected:true} });
    if (createError || !created.user) throw createError || new Error("Creazione identità Admin fallita");
    authUserId = created.user.id;
  }
  const { error:profileError } = await admin.from("profiles").upsert({ auth_user_id:authUserId, legacy_user_id:legacy.id, display_name:"Randagio", department:"Sviluppo", email:legacy.email||null, phone:legacy.telefono||null, phone_country_code:legacy.phone_country_code||"+39", active:true, is_system_protected:true, updated_at:new Date().toISOString() }, { onConflict:"auth_user_id" });
  if (profileError) throw profileError;
  const rows = ALL_HOTELS.map((hotel_id) => ({auth_user_id:authUserId,hotel_id,role:"admin",active:true,can_access_admin:true}));
  const { error:membershipError } = await admin.from("hotel_memberships").upsert(rows,{onConflict:"auth_user_id,hotel_id"});
  if (membershipError) throw membershipError;
  return { authUserId, internalEmail };
}

async function readAdminPinHash() {
  const { data:newSecret } = await admin.from("edge_function_secrets").select("value").eq("key","ADMIN_PANEL_PIN_BCRYPT").maybeSingle();
  if (newSecret?.value) return { value:String(newSecret.value), legacy:false };
  const { data:oldSecret, error } = await admin.from("edge_function_secrets").select("value").eq("key","ADMIN_PANEL_PIN_SHA256").maybeSingle();
  if (error || !oldSecret?.value) throw error || new Error("PIN Admin non configurato");
  return { value:String(oldSecret.value), legacy:true };
}

async function verifyAdminPin(pin: string) {
  const stored = await readAdminPinHash();
  const valid = stored.legacy ? (await sha256(pin)) === stored.value : await bcrypt.compare(pin, stored.value);
  if (valid && stored.legacy) {
    const hash = await bcrypt.hash(pin, 12);
    await admin.from("edge_function_secrets").upsert({key:"ADMIN_PANEL_PIN_BCRYPT",value:hash},{onConflict:"key"});
    await admin.from("edge_function_secrets").delete().eq("key","ADMIN_PANEL_PIN_SHA256");
  }
  return valid;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", {headers:cors});
  if (req.method !== "POST") return json({ok:false,error:"Metodo non consentito"},405);
  try {
    const body = await req.json().catch(() => null);
    const action = String(body?.action || "login");
    if (action === "change_pin") {
      const newPin = String(body?.new_pin || "").trim();
      if (!/^\d{6}$/.test(newPin)) return json({ok:false,error:"Il PIN Admin deve avere 6 cifre"},400);
      await requireProtectedAdmin(req);
      const hash = await bcrypt.hash(newPin, 12);
      const { error } = await admin.from("edge_function_secrets").upsert({key:"ADMIN_PANEL_PIN_BCRYPT",value:hash},{onConflict:"key"});
      if (error) throw error;
      await admin.from("edge_function_secrets").delete().eq("key","ADMIN_PANEL_PIN_SHA256");
      return json({ok:true});
    }

    const pin = String(body?.pin || "").trim();
    if (!/^\d{6}$/.test(pin)) return json({ok:false,error:"PIN Admin non valido"},400);
    const throttle = await throttleState(req);
    if (throttle.locked) return json({ok:false,error:"Troppi tentativi. Riprova più tardi."},429);
    if (!await verifyAdminPin(pin)) {
      const nowLocked = await recordFailure(throttle.key, throttle.failures);
      return json({ok:false,error:nowLocked ? "Troppi tentativi. Riprova più tardi." : "PIN Admin non valido"}, nowLocked ? 429 : 401);
    }
    await clearFailures(throttle.key);

    const {authUserId,internalEmail} = await ensureRandagio();
    const password = crypto.randomUUID() + crypto.randomUUID();
    const {error:passwordError} = await admin.auth.admin.updateUserById(authUserId,{password});
    if (passwordError) throw passwordError;
    const client = createClient(URL,ANON,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:signed,error:signError} = await client.auth.signInWithPassword({email:internalEmail,password});
    if (signError || !signed.session) throw signError || new Error("Creazione sessione Admin fallita");
    return json({ok:true,session:{access_token:signed.session.access_token,refresh_token:signed.session.refresh_token,expires_at:signed.session.expires_at},user:{id:authUserId,name:"Randagio",role:"admin",department:"Sviluppo",hotels:ALL_HOTELS,can_admin:true,protected:true,active:true}});
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    if (message === "UNAUTHORIZED") return json({ok:false,error:"Non autenticato"},401);
    if (message === "FORBIDDEN") return json({ok:false,error:"Permesso Admin protetto richiesto"},403);
    console.error("admin-gate",message);
    return json({ok:false,error:"Errore temporaneo accesso Admin"},500);
  }
});