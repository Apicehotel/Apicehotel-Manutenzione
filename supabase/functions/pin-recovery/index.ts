import { createClient } from "npm:@supabase/supabase-js@2";
const url=Deno.env.get("SUPABASE_URL")!;
const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
const WINDOW_MS=30*60*1000;
const MAX_ATTEMPTS=3;

async function sha256(value:string){const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,"0")).join("")}
async function rateKey(req:Request,email:string){const forwarded=req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();const address=req.headers.get("cf-connecting-ip")?.trim()||req.headers.get("x-real-ip")?.trim()||forwarded||"unknown";return sha256(`${service.slice(0,24)}|${address}|${email}`)}
async function consumeRate(req:Request,email:string){const key=await rateKey(req,email);const now=Date.now();const{data,error}=await admin.from("pin_recovery_rate_limits").select("attempts,window_started_at").eq("source_hash",key).maybeSingle();if(error)throw error;const started=data?.window_started_at?new Date(data.window_started_at).getTime():0;if(!data||!started||now-started>=WINDOW_MS){const e=(await admin.from("pin_recovery_rate_limits").upsert({source_hash:key,attempts:1,window_started_at:new Date(now).toISOString(),updated_at:new Date(now).toISOString()},{onConflict:"source_hash"})).error;if(e)throw e;return true}if(Number(data.attempts||0)>=MAX_ATTEMPTS)return false;const e=(await admin.from("pin_recovery_rate_limits").update({attempts:Number(data.attempts||0)+1,updated_at:new Date(now).toISOString()}).eq("source_hash",key)).error;if(e)throw e;return true}
async function cleanup(){const cutoff=new Date(Date.now()-24*60*60*1000).toISOString();await admin.from("pin_recovery_rate_limits").delete().lt("updated_at",cutoff)}

Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({ok:false,error:"method_not_allowed"},405);
 const started=Date.now();
 try{
  const{data:flag}=await admin.from("integration_settings").select("enabled").eq("key","pin_recovery_email").maybeSingle();
  if(!flag?.enabled)return json({ok:true,enabled:false,status:"disabled"});
  const body=await req.json().catch(()=>({})); const email=String(body?.email||"").trim().toLowerCase().slice(0,320);
  if(!email||!/^\S+@\S+\.\S+$/.test(email)){await new Promise(r=>setTimeout(r,250));return json({ok:true})}
  const allowed=await consumeRate(req,email);
  if(allowed){
   const{data:profile}=await admin.from("profiles").select("auth_user_id,email,active").eq("email",email).maybeSingle();
   if(profile?.active&&profile?.auth_user_id){
     const raw=crypto.randomUUID()+crypto.randomUUID();
     const tokenHash=await sha256(raw);
     await admin.from("pin_recovery_requests").insert({auth_user_id:profile.auth_user_id,email,token_hash:tokenHash,expires_at:new Date(Date.now()+15*60*1000).toISOString()});
     await admin.from("notification_outbox").insert({channel:"email",recipient:email,subject:"Recupero PIN",body:"Richiesta di recupero PIN",status:"pending",metadata:{purpose:"pin_recovery",token:raw}});
   }
  }
  await cleanup();
  const wait=Math.max(0,250-(Date.now()-started));if(wait)await new Promise(r=>setTimeout(r,wait));
  return json({ok:true});
 }catch(error){console.error("pin-recovery",error instanceof Error?error.message:"unknown");const wait=Math.max(0,250-(Date.now()-started));if(wait)await new Promise(r=>setTimeout(r,wait));return json({ok:true})}
});
