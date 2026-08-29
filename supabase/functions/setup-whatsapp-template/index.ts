import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
const ALL_HOTELS = ["hotelgio","chocohotel","brigantino"];
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control":"no-store" } });

async function requireProtectedAdmin(req: Request) {
  const token = req.headers.get("authorization") || "";
  const client = createClient(SUPABASE_URL, ANON, { global:{ headers:{ Authorization:token } }, auth:{ persistSession:false, autoRefreshToken:false } });
  const { data:userData, error:userError } = await client.auth.getUser();
  if (userError || !userData.user) throw new Error("UNAUTHORIZED");
  const uid = userData.user.id;
  const { data:profile } = await admin.from("profiles").select("active,is_system_protected").eq("auth_user_id",uid).maybeSingle();
  if (!profile?.active || !profile.is_system_protected) throw new Error("FORBIDDEN");
  const { data:memberships, error } = await admin.from("hotel_memberships").select("hotel_id,role,active,can_access_admin").eq("auth_user_id",uid);
  if (error) throw error;
  const allowed = new Set((memberships || []).filter((m:any)=>m.active&&(m.role==="admin"||m.can_access_admin)).map((m:any)=>String(m.hotel_id)));
  if (!ALL_HOTELS.every((hotel)=>allowed.has(hotel))) throw new Error("FORBIDDEN");
}

async function secret(key: string): Promise<string | null> {
  const { data } = await admin.from("edge_function_secrets").select("value").eq("key", key).maybeSingle();
  return data?.value || null;
}

async function saveStato(templateKey: string, contentSid: string, status: string, rejectionReason: string) {
  await admin.from("whatsapp_template_status").upsert({
    template_key: templateKey, content_sid: contentSid, status, rejection_reason: rejectionReason, controllato_il: new Date().toISOString(),
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    await requireProtectedAdmin(req);
    const sid = await secret("twilio_account_sid");
    const token = await secret("twilio_auth_token");
    if (!sid || !token) return json({ ok: false, error: "Credenziali Twilio non configurate" }, 500);
    const authHeader = "Basic " + btoa(`${sid}:${token}`);
    const url = new URL(req.url);
    const getSid = url.searchParams.get("getSid");
    if (getSid) {
      const res = await fetch(`https://content.twilio.com/v1/Content/${encodeURIComponent(getSid)}`, { headers: { Authorization: authHeader } });
      return json(await res.json(), res.ok ? 200 : res.status);
    }
    const checkKey = url.searchParams.get("checkKey");
    if (checkKey) {
      const { data: row } = await admin.from("whatsapp_template_status").select("content_sid").eq("template_key", checkKey).maybeSingle();
      if (!row?.content_sid) return json({ ok: false, error: "Template non trovato" }, 404);
      const res = await fetch(`https://content.twilio.com/v1/Content/${encodeURIComponent(row.content_sid)}/ApprovalRequests`, { headers: { Authorization: authHeader } });
      const data = await res.json();
      const status = data?.whatsapp?.status || "sconosciuto";
      const rejectionReason = data?.whatsapp?.rejection_reason || "";
      await saveStato(checkKey, row.content_sid, status, rejectionReason);
      return json(data, res.ok ? 200 : res.status);
    }
    if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
    const body = await req.json().catch(()=>({}));
    const templateKey = String(body?.template_key || "").trim().slice(0,80);
    const friendlyName = String(body?.friendly_name || `${templateKey}_v1`).trim().slice(0,80);
    const bodyText = String(body?.body || "").trim().slice(0,4000);
    const variables = body?.variables;
    const category = String(body?.category || "UTILITY").trim().toUpperCase();
    const media = body?.media || null;
    if (!/^[A-Za-z0-9._-]{1,80}$/.test(templateKey)) return json({ ok:false,error:"template_key non valido" },400);
    if (!bodyText || !variables || typeof variables !== "object" || Array.isArray(variables)) return json({ ok:false,error:"body e variables sono obbligatori" },400);
    if (!new Set(["UTILITY","MARKETING","AUTHENTICATION"]).has(category)) return json({ok:false,error:"category non valida"},400);
    const types = media ? { "twilio/media": { body: bodyText, media } } : { "twilio/text": { body: bodyText } };
    const createRes = await fetch("https://content.twilio.com/v1/Content", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: authHeader }, body: JSON.stringify({ friendly_name: friendlyName, language: "it", variables, types }),
    });
    const created = await createRes.json();
    if (!createRes.ok) return json({ ok:false,step:"create",error:"Twilio Content API ha rifiutato la richiesta" }, createRes.status >= 400 && createRes.status < 600 ? createRes.status : 502);
    const contentSid = created.sid;
    const approveRes = await fetch(`https://content.twilio.com/v1/Content/${encodeURIComponent(contentSid)}/ApprovalRequests/whatsapp`, {
      method:"POST", headers:{"Content-Type":"application/json",Authorization:authHeader}, body:JSON.stringify({name:friendlyName,category}),
    });
    const approval = await approveRes.json();
    await saveStato(templateKey, contentSid, approval?.status || "submitted", "");
    return json({ ok:approveRes.ok, template_key:templateKey, contentSid, approval: { status:approval?.status || null } }, approveRes.ok ? 200 : 502);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    if (message === "UNAUTHORIZED") return json({ok:false,error:"Non autenticato"},401);
    if (message === "FORBIDDEN") return json({ok:false,error:"Admin protetto richiesto"},403);
    console.error("setup-whatsapp-template", message);
    return json({ok:false,error:"Errore temporaneo gestione template"},500);
  }
});