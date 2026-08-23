import { createClient } from "npm:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(url, service, { auth: { persistSession:false, autoRefreshToken:false } });
const json = (body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
const HOTEL_NAMES:Record<string,string>={hotelgio:"Hotel Giò",chocohotel:"Chocohotel",brigantino:"Hotel Il Brigantino"};

async function secret(key:string){const{data}=await admin.from("edge_function_secrets").select("value").eq("key",key).maybeSingle();return data?.value||null}
async function logEvent(job:any,type:string,details:any={}){await admin.from("richieste_urgenti_eventi").insert({urgente_id:job.urgent_id,hotel_id:job.hotel_id,tipo:type,da_chi:"Sistema",dettagli:{step:job.step,channel:job.channel,...details}})}
async function mark(job:any,status:string,error:string|null=null){await admin.from("urgent_reminder_jobs").update({status,last_error:error,updated_at:new Date().toISOString(),sent_at:status==="sent"?new Date().toISOString():job.sent_at||null}).eq("id",job.id)}
async function retry(job:any,error:string){const attempts=(job.attempts||0)+1;if(attempts>=3){await admin.from("urgent_reminder_jobs").update({status:"failed",attempts,last_error:error,updated_at:new Date().toISOString()}).eq("id",job.id);return}await admin.from("urgent_reminder_jobs").update({status:"pending",attempts,last_error:error,next_attempt_at:new Date(Date.now()+30000).toISOString(),updated_at:new Date().toISOString()}).eq("id",job.id)}

Deno.serve(async(req:Request)=>{
  if(req.method!=="POST") return json({ok:false,error:"method_not_allowed"},405);
  const expected=await secret("urgent_reminder_cron_secret");
  if(!expected||req.headers.get("x-cron-secret")!==expected) return json({ok:false,error:"forbidden"},403);
  const now=new Date().toISOString();
  const{data:jobs,error}=await admin.from("urgent_reminder_jobs").select("*").eq("status","pending").lte("next_attempt_at",now).order("next_attempt_at",{ascending:true}).limit(50);
  if(error) return json({ok:false,error:"queue_read_failed"},500);
  const{data:ntfySetting}=await admin.from("integration_settings").select("enabled,config").eq("key","ntfy_alerts").maybeSingle();
  const{data:waSetting}=await admin.from("integration_settings").select("enabled,config").eq("key","urgent_whatsapp").maybeSingle();
  const sid=await secret("twilio_account_sid"); const token=await secret("twilio_auth_token"); const waFrom=await secret("twilio_whatsapp_from");
  let sent=0,cancelled=0,blocked=0,failed=0;
  for(const job of jobs||[]){
    const{data:urgent}=await admin.from("richieste_urgenti").select("id,hotel_id,nota,gravita,posizione,reparto,stato").eq("id",job.urgent_id).eq("hotel_id",job.hotel_id).maybeSingle();
    if(!urgent||urgent.stato!=="aperta"){await mark(job,"cancelled");cancelled++;continue}
    await admin.from("urgent_reminder_jobs").update({status:"processing",updated_at:new Date().toISOString()}).eq("id",job.id).eq("status","pending");
    const hotelName=HOTEL_NAMES[job.hotel_id]||job.hotel_id; const severity=urgent.gravita==="emergenza"?"EMERGENZA":"URGENTE"; const body=[urgent.posizione,urgent.reparto,urgent.nota].filter(Boolean).join(" · ");
    try{
      if(job.channel==="ntfy"){
        const server=String(ntfySetting?.config?.server||"https://ntfy.sh").replace(/\/$/,""); const topic=String(ntfySetting?.config?.topics?.[job.hotel_id]||"");
        if(!ntfySetting?.enabled||!topic){await mark(job,"blocked","ntfy_not_configured");blocked++;continue}
        const res=await fetch(server,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({topic,title:`${severity} · ${hotelName}`,message:body||"Avviso urgente ancora senza presa in carico",priority:5,tags:["rotating_light","warning"],click:`https://apicehotel-manutenzionr.vercel.app/?notification=urgent&hotel_id=${encodeURIComponent(job.hotel_id)}&urgent_id=${encodeURIComponent(job.urgent_id)}`})});
        if(!res.ok) throw new Error(`ntfy_${res.status}`);
        await mark(job,"sent"); await logEvent(job,"reminder_ntfy",{priority:5}); sent++; continue;
      }
      if(job.channel==="whatsapp"){
        const recipients=waSetting?.config?.recipients?.[job.hotel_id];
        if(!waSetting?.enabled||!sid||!token||!waFrom||!Array.isArray(recipients)||!recipients.length){await mark(job,"blocked","whatsapp_not_configured");await logEvent(job,"reminder_whatsapp_non_inviato",{reason:"not_configured"});blocked++;continue}
        const auth="Basic "+btoa(`${sid}:${token}`); let delivered=0;
        for(const raw of recipients){const to=String(raw).startsWith("whatsapp:")?String(raw):`whatsapp:${raw}`; const params=new URLSearchParams({From:String(waFrom).startsWith("whatsapp:")?String(waFrom):`whatsapp:${waFrom}`,To:to,Body:`${severity} ${hotelName}: ${body||"avviso urgente senza presa in carico"}. Apri RandApp.`}); const res=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,{method:"POST",headers:{Authorization:auth,"Content-Type":"application/x-www-form-urlencoded"},body:params}); if(res.ok) delivered++; else throw new Error(`twilio_${res.status}`)}
        await mark(job,"sent"); await logEvent(job,"reminder_whatsapp",{delivered}); sent++; continue;
      }
    }catch(e){failed++;await retry(job,e instanceof Error?e.message:"delivery_failed")}
  }
  return json({ok:true,processed:(jobs||[]).length,sent,cancelled,blocked,failed});
});
