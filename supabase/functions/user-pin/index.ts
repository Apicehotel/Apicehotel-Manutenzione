import { createClient } from "npm:@supabase/supabase-js@2";
import bcrypt from "npm:bcryptjs@2.4.3";

const url = Deno.env.get("SUPABASE_URL")!;
const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type":"application/json", "Cache-Control":"no-store" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok:false, error:"Metodo non consentito" }, 405);
  try {
    const authHeader = req.headers.get("authorization") || "";
    const client = createClient(url, anon, { global:{ headers:{ Authorization:authHeader } }, auth:{ persistSession:false, autoRefreshToken:false } });
    const { data:userData, error:userError } = await client.auth.getUser();
    if (userError || !userData.user) return json({ ok:false, error:"Non autenticato" }, 401);
    const uid = userData.user.id;
    const body = await req.json().catch(() => null);
    const action = String(body?.action || "change_pin");

    if (action === "set_presence") {
      const present = Boolean(body?.present);
      const { data:profile } = await admin.from("profiles").select("active,legacy_user_id").eq("auth_user_id", uid).maybeSingle();
      if (!profile?.active) return json({ ok:false, error:"Utente non attivo" }, 403);
      if (!profile.legacy_user_id) return json({ ok:false, error:"Utente non collegato" }, 404);
      const now = new Date().toISOString();
      const { error:updateError } = await admin.from("utenti").update({ in_struttura:present, in_struttura_dal:present ? now : null, in_struttura_via:present ? "app" : null }).eq("id", profile.legacy_user_id);
      if (updateError) throw updateError;
      return json({ ok:true, in_struttura:present, in_struttura_dal:present ? now : null });
    }

    if (action === "update_profile") {
      const { data:profile } = await admin.from("profiles").select("legacy_user_id,active,is_system_protected").eq("auth_user_id", uid).maybeSingle();
      if (!profile?.active) return json({ ok:false, error:"Utente non attivo" }, 403);
      if (profile.is_system_protected) return json({ ok:false, error:"Account protetto: modifica non consentita" }, 403);
      const profilePatch: Record<string, unknown> = {};
      const legacyPatch: Record<string, unknown> = {};
      if (body?.email !== undefined) { const email = body.email ? String(body.email).trim().toLowerCase() : null; profilePatch.email = email; profilePatch.email_verified = false; legacyPatch.email = email; legacyPatch.email_verified = false; }
      if (body?.phone !== undefined || body?.phone_country_code !== undefined) {
        const country = String(body?.phone_country_code || "+39");
        if (!/^\+[1-9]\d{0,3}$/.test(country)) return json({ ok:false, error:"Prefisso telefono non valido" }, 400);
        let phone: string | null = null;
        if (body?.phone) { const raw = String(body.phone).trim(); phone = raw.startsWith("+") ? `+${raw.slice(1).replace(/\D/g, "")}` : `${country}${raw.replace(/\D/g, "")}`; if (phone && !/^\+[1-9]\d{7,14}$/.test(phone)) return json({ ok:false, error:"Numero telefono non valido" }, 400); }
        profilePatch.phone = phone; profilePatch.phone_country_code = country; profilePatch.phone_verified = false; legacyPatch.telefono = phone; legacyPatch.phone_country_code = country; legacyPatch.phone_verified = false;
      }
      if (!Object.keys(profilePatch).length) return json({ ok:false, error:"Nessuna modifica da salvare" }, 400);
      const { error:pErr } = await admin.from("profiles").update(profilePatch).eq("auth_user_id", uid); if (pErr) throw pErr;
      if (profile.legacy_user_id && Object.keys(legacyPatch).length) { const { error:lErr } = await admin.from("utenti").update(legacyPatch).eq("id", profile.legacy_user_id); if (lErr) throw lErr; }
      return json({ ok:true });
    }

    const currentPin = String(body?.current_pin || "");
    const newPin = String(body?.new_pin || "");
    if (!/^\d{4}$/.test(currentPin)) return json({ ok:false, error:"Il PIN attuale deve avere 4 cifre" }, 400);
    if (!/^\d{4}$/.test(newPin)) return json({ ok:false, error:"Il nuovo PIN deve avere 4 cifre" }, 400);
    if (currentPin === newPin) return json({ ok:false, error:"Il nuovo PIN deve essere diverso" }, 400);

    const { data:profile } = await admin.from("profiles").select("active").eq("auth_user_id", uid).maybeSingle();
    if (!profile?.active) return json({ ok:false, error:"Utente non attivo" }, 403);
    const { data:cred, error:credError } = await admin.from("auth_pin_credentials").select("pin_hash,failed_attempts,locked_until").eq("auth_user_id", uid).single();
    if (credError || !cred) return json({ ok:false, error:"Credenziali PIN non disponibili" }, 404);
    if (cred.locked_until && new Date(cred.locked_until).getTime() > Date.now()) return json({ ok:false, error:"Troppi tentativi. Riprova più tardi." }, 429);

    const valid = await bcrypt.compare(currentPin, cred.pin_hash);
    if (!valid) {
      const attempts = Number(cred.failed_attempts || 0) + 1;
      const patch: Record<string, unknown> = { failed_attempts:attempts };
      if (attempts >= 5) { patch.failed_attempts = 0; patch.locked_until = new Date(Date.now() + 600000).toISOString(); }
      await admin.from("auth_pin_credentials").update(patch).eq("auth_user_id", uid);
      return json({ ok:false, error:"PIN attuale non valido" }, 401);
    }

    const hash = await bcrypt.hash(newPin, 11);
    const now = new Date().toISOString();
    const { error:updateError } = await admin.from("auth_pin_credentials").update({ pin_hash:hash, must_change_pin:false, failed_attempts:0, locked_until:null, updated_at:now }).eq("auth_user_id", uid);
    if (updateError) throw updateError;
    await admin.from("profiles").update({ last_pin_change_at:now }).eq("auth_user_id", uid);
    return json({ ok:true });
  } catch (error) {
    console.error("user-pin", error instanceof Error ? error.message : "unknown");
    return json({ ok:false, error:"Errore user-pin" }, 500);
  }
});
