import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const url = Deno.env.get("SUPABASE_URL")!;
const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(url, service, { auth: { persistSession:false, autoRefreshToken:false } });
const json = (body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
const HOTEL_NAMES:Record<string,string>={hotelgio:"Hotel Giò",chocohotel:"Chocohotel",brigantino:"Hotel Il Brigantino"};
const APP_URL="https://apicehotel.vercel.app";
const PUSH_ROLES=["admin","manutentore","Direzione","Direttore Centro Congressi","Portiere Notturno","Reception"];

async function secret(key:string){const{data}=await admin.from("edge_function_secrets").select("value").eq("key",key).maybeSingle();return data?.value||null}
async function logEvent(job:any,type:string,details:any={}){await admin.from("richieste_urgenti_eventi").insert({urgente_id:job.urgent_id,hotel_id:job.hotel_id,tipo:type,da_chi:"Sistema",dettagli:{step:job.step,channel:job.channel,...details}})}
async function mark(job:any,status:string,error:string|null=null){await admin.from("urgent_reminder_jobs").update({status,last_error:error,updated_at:new Date().toISOString(),sent_at:status==="sent"?new Date().toISOString():job.sent_at||null}).eq("id",job.id)}
async function retry(job:any,error:string,delayMs=30000){const attempts=(job.attempts||0)+1;if(attempts>=3){await admin.from("urgent_reminder_jobs").update({status:"failed",attempts,last_error:error,updated_at:new Date().toISOString()}).eq("id",job.id);return}await admin.from("urgent_reminder_jobs").update({status:"pending",attempts,last_error:error,next_attempt_at:new Date(Date.now()+delayMs).toISOString(),updated_at:new Date().toISOString()}).eq("id",job.id)}

async function pushFallback(job:any,urgent:any,title:string,message:string){
  const{data:flag}=await admin.from("integration_settings").select("enabled").eq("key","push_notifications").maybeSingle();
  if(!flag?.enabled)return 0;
  const{data:members}=await admin.from("hotel_memberships").select("auth_user_id").eq("hotel_id",job.hotel_id).eq("active",true).in("role",PUSH_ROLES);
  const ids=[...new Set((members||[]).map((r:any)=>String(r.auth_user_id||"")).filter(Boolean))];
  if(!ids.length)return 0;
  const{data:subs}=await admin.from("push_subscriptions").select("id,endpoint,p256dh,auth,utente").eq("hotel_id",job.hotel_id).in("utente",ids);
  if(!subs?.length)return 0;
  const unique=[...new Map(subs.map((s:any)=>[s.endpoint,s])).values()] as any[];
  const{data:secrets}=await admin.from("edge_function_secrets").select("key,value").in("key",["vapid_public","vapid_private","vapid_subject"]);
  const sm=new Map((secrets||[]).map((r:any)=>[r.key,r.value]));
  const pub=sm.get("vapid_public"),priv=sm.get("vapid_private"),subject=sm.get("vapid_subject")||"mailto:appmanutenzioneapice@gmail.com";
  if(!pub||!priv)return 0;
  webpush.setVapidDetails(subject,pub,priv);
  const target=`/?notification=urgent&hotel_id=${encodeURIComponent(job.hotel_id)}&urgent_id=${encodeURIComponent(job.urgent_id)}`;
  const payload=JSON.stringify({title,body:message,tag:`avviso-urgente-${job.urgent_id}-r${job.step}`,url:target,urgent:true,eventType:"urgent",urgentId:job.urgent_id,hotelId:job.hotel_id,severity:urgent.gravita==="emergenza"?"emergenza":"urgente"});
  let sent=0;const expired:string[]=[];
  await Promise.all(unique.map(async(s:any)=>{try{await webpush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},payload);sent++}catch(e:any){if(e?.statusCode===404||e?.statusCode===410)expired.push(s.id)}}));
  if(expired.length)await admin.from("push_subscriptions").delete().in("id",expired);
  if(sent>0){await admin.from("notification_outbox").insert({channel:"push",hotel_id:job.hotel_id,subject:title,body:message,status:"sent",sent_at:new Date().toISOString(),metadata:{event_type:"urgent_reminder",urgent_id:job.urgent_id,step:job.step,fallback_from:"ntfy"}})}
  return sent;
}

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
  let sent=0,cancelled=0,blocked=0,failed=0,fallbackSent=0;
  for(const job of jobs||[]){
    const{data:urgent}=await admin.from("richieste_urgenti").select("id,hotel_id,nota,gravita,posizione,reparto,stato").eq("id",job.urgent_id).eq("hotel_id",job.hotel_id).maybeSingle();
    if(!urgent||urgent.stato!=="aperta"){await mark(job,"cancelled");cancelled++;continue}
    await admin.from("urgent_reminder_jobs").update({status:"processing",updated_at:new Date().toISOString()}).eq("id",job.id).eq("status","pending");
    const hotelName=HOTEL_NAMES[job.hotel_id]||job.hotel_id; const severity=urgent.gravita==="emergenza"?"EMERGENZA":"URGENTE"; const body=[urgent.posizione,urgent.reparto,urgent.nota].filter(Boolean).join(" · ");
    const title=`${severity} · ${hotelName}`; const message=body||"Avviso urgente ancora senza presa in carico";
    try{
      if(job.channel==="ntfy"){
        const server=String(ntfySetting?.config?.server||"https://ntfy.sh").replace(/\/$/,""); const topic=String(ntfySetting?.config?.topics?.[job.hotel_id]||"");
        if(!ntfySetting?.enabled||!topic){await mark(job,"blocked","ntfy_not_configured");blocked++;continue}
        const click=`${APP_URL}/?notification=urgent&hotel_id=${encodeURIComponent(job.hotel_id)}&urgent_id=${encodeURIComponent(job.urgent_id)}`;
        const res=await fetch(server,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({topic,title,message,priority:5,tags:["rotating_light","warning"],click})});
        if(!res.ok){
          if(res.status===429){
            const delivered=await pushFallback(job,urgent,title,message);
            if(delivered>0){await mark(job,"sent","ntfy_429_push_fallback");await logEvent(job,"reminder_push_fallback",{reason:"ntfy_429",delivered});sent++;fallbackSent+=delivered;continue}
            const retryAfter=Number(res.headers.get("retry-after")||0);await retry(job,"ntfy_429",retryAfter>0?retryAfter*1000:60000);failed++;continue;
          }
          throw new Error(`ntfy_${res.status}`)
        }
        await mark(job,"sent"); await logEvent(job,"reminder_ntfy",{priority:5,click}); sent++; continue;
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
  return json({ok:true,processed:(jobs||[]).length,sent,cancelled,blocked,failed,fallbackSent});
});
