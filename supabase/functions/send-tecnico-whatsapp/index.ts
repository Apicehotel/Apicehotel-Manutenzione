import { createClient } from "npm:@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const clean = (v: unknown, max = 1000) => String(v ?? "").trim().slice(0, max);

async function secret(key: string) { const { data } = await admin.from("edge_function_secrets").select("value").eq("key", key).maybeSingle(); return data?.value || null; }
async function sha256(value: string) { const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)); return [...new Uint8Array(d)].map((b)=>b.toString(16).padStart(2,"0")).join(""); }
const authority = (role: string) => ["direzione","direttore centro congressi","reception"].includes(clean(role,80).toLowerCase());
function e164(raw: string) { const x=clean(raw,40).replace(/[^\d+]/g,""); if(x.startsWith("+"))return x;if(x.startsWith("39")&&x.length>10)return `+${x}`;return `+39${x.replace(/^0+/,"")}`; }

async function actor(req: Request, hotelId: string) {
  const client = createClient(URL, ANON, { global: { headers: { Authorization: req.headers.get("authorization") || "" } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: u, error } = await client.auth.getUser();
  if (error || !u.user) return null;
  const { data: membership } = await admin.from("hotel_memberships").select("role,active").eq("auth_user_id",u.user.id).eq("hotel_id",hotelId).eq("active",true).maybeSingle();
  if (!membership || !authority(membership.role)) return null;
  return { userId:u.user.id, role:membership.role };
}

async function sendTemplate(accountSid:string, authToken:string, from:string, to:string, contentSid:string, variables:Record<string,string>) {
  const form=new URLSearchParams({From:from.startsWith("whatsapp:")?from:`whatsapp:${from}`,To:`whatsapp:${to}`,ContentSid:contentSid,ContentVariables:JSON.stringify(variables)});
  const res=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded",Authorization:`Basic ${btoa(`${accountSid}:${authToken}`)}`},body:form.toString()});
  const data=await res.json().catch(()=>null);
  return { ok:res.ok,httpStatus:res.status,sid:data?.sid||null,status:data?.status||null,errorCode:data?.error_code||null,errorMessage:data?.message||data?.error_message||null };
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return json({ok:false,error:"method_not_allowed"},405);
  try{
    const body=await req.json().catch(()=>null); const requestId=clean(body?.request_id||body?.requestId,120); const token=clean(body?.token,200);
    if(!requestId||!token)return json({ok:false,error:"request_id_and_token_required"},400);
    const {data:dispatch}=await admin.from("technician_dispatch_requests").select("*").eq("id",requestId).maybeSingle();
    if(!dispatch||!["authorized","dispatched"].includes(dispatch.status))return json({ok:false,error:"dispatch_not_sendable"},409);
    const who=await actor(req,dispatch.hotel_id); if(!who)return json({ok:false,error:"authorization_role_required"},403);
    const hash=await sha256(token);
    const {data:access}=await admin.from("technician_dispatch_tokens").select("id,technician_id,expires_at,revoked_at,ended_at").eq("dispatch_request_id",dispatch.id).eq("token_hash",hash).maybeSingle();
    if(!access||access.revoked_at||access.ended_at||new Date(access.expires_at).getTime()<=Date.now()||access.technician_id!==dispatch.technician_id)return json({ok:false,error:"invalid_dispatch_token"},401);
    const [{data:tech},{data:issue},{data:channel},{data:tpl}]=await Promise.all([
      admin.from("external_technicians").select("id,name,phone,active,hotel_id").eq("id",dispatch.technician_id).maybeSingle(),
      admin.from("segnalazioni").select("id,hotel_id,camera,note,categoria").eq("id",dispatch.issue_id).eq("hotel_id",dispatch.hotel_id).maybeSingle(),
      admin.from("whatsapp_channel_settings").select("inbound_number,receive_enabled").eq("hotel_id",dispatch.hotel_id).maybeSingle(),
      admin.from("whatsapp_template_status").select("content_sid,status,rejection_reason").eq("template_key","richiesta_tecnico_portale").maybeSingle(),
    ]);
    if(!tech?.active||tech.hotel_id!==dispatch.hotel_id||!issue)return json({ok:false,error:"technician_or_issue_unavailable"},409);
    if(!channel?.receive_enabled||!channel?.inbound_number)return json({ok:false,error:"hotel_whatsapp_not_configured"},503);
    if(!tpl?.content_sid||tpl.status!=="approved"){
      await admin.from("technician_dispatch_requests").update({notification_status:"template_required",notification_error:tpl?.rejection_reason||`template status: ${tpl?.status||"missing"}`,updated_at:new Date().toISOString()}).eq("id",dispatch.id);
      return json({ok:false,error:"template_not_approved",template_key:"richiesta_tecnico_portale",template_status:tpl?.status||"missing"},503);
    }
    const accountSid=await secret("twilio_account_sid"),authToken=await secret("twilio_auth_token");
    if(!accountSid||!authToken)return json({ok:false,error:"twilio_not_configured"},503);
    const portalUrl=`https://apicehotel.vercel.app/tecnico/${encodeURIComponent(token)}`;
    const result=await sendTemplate(accountSid,authToken,channel.inbound_number,e164(tech.phone),tpl.content_sid,{"1":tech.name,"2":issue.camera||"-","3":clean(issue.note||issue.categoria,500)||"Intervento manutenzione","4":portalUrl});
    if(!result.ok){await admin.from("technician_dispatch_requests").update({notification_status:"error",notification_error:result.errorMessage||String(result.errorCode||result.httpStatus),updated_at:new Date().toISOString()}).eq("id",dispatch.id);return json({ok:false,error:"twilio_send_failed",detail:result},502);}
    const now=new Date().toISOString();
    await admin.from("technician_dispatch_requests").update({status:"dispatched",dispatched_at:now,notification_sid:result.sid,notification_status:result.status||"sent",notification_error:null,notification_sent_at:now,updated_at:now}).eq("id",dispatch.id);
    return json({ok:true,sid:result.sid,status:result.status||"sent"});
  }catch(error){console.error("send-tecnico-whatsapp",error instanceof Error?error.message:"unknown");return json({ok:false,error:"temporary_error"},500);}
});
