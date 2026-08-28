import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const url=Deno.env.get("SUPABASE_URL")!;
const anon=Deno.env.get("SUPABASE_ANON_KEY")!;
const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
const HOTEL_NAMES:Record<string,string>={hotelgio:"Hotel Giò",chocohotel:"Chocohotel",brigantino:"Hotel Il Brigantino"};
const ids=(value:any)=>Array.isArray(value)?[...new Set(value.map((x:any)=>String(x?.id||x||"").trim()).filter(Boolean))]:[];
async function personalTopic(hotelId:string,userId:string){const bytes=new TextEncoder().encode(`randapp-assignment:${hotelId}:${userId}:${service}`);const digest=await crypto.subtle.digest("SHA-256",bytes);const token=Array.from(new Uint8Array(digest)).slice(0,18).map(x=>x.toString(16).padStart(2,"0")).join("");return `randapp-job-${hotelId}-${token}`;}

Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({ok:false,error:"method_not_allowed"},405);
 try{
  const client=createClient(url,anon,{global:{headers:{Authorization:req.headers.get("authorization")||""}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:userData,error:userError}=await client.auth.getUser();
  if(userError||!userData.user)return json({ok:false,error:"unauthorized"},401);
  const body=await req.json().catch(()=>({}));
  const hotelId=String(body?.hotel_id||"").trim();const interventionId=String(body?.intervention_id||"").trim();
  if(!hotelId||!interventionId)return json({ok:false,error:"hotel_and_intervention_required"},400);
  const {data:caller}=await admin.from("hotel_memberships").select("role,active").eq("auth_user_id",userData.user.id).eq("hotel_id",hotelId).maybeSingle();
  if(!caller?.active)return json({ok:false,error:"forbidden"},403);
  const {data:assignPermission}=await admin.from("role_permissions").select("allowed").eq("role",caller.role).eq("module","interventions").eq("action","assign").maybeSingle();
  if(!assignPermission?.allowed)return json({ok:false,error:"forbidden"},403);
  const {data:item}=await admin.from("interventi").select("id,hotel_id,sezione,camera,categoria,note,assegnatari,programmato_dal").eq("id",interventionId).eq("hotel_id",hotelId).maybeSingle();
  if(!item||item.sezione!=="intervento")return json({ok:false,error:"intervention_not_found"},404);
  const assigned=ids(item.assegnatari);const requested=ids(body?.assignee_ids);const targets=requested.length?requested.filter(id=>assigned.includes(id)):assigned;
  if(!targets.length)return json({ok:true,status:"no_targets",push_sent:0,ntfy_sent:0});
  const {data:members}=await admin.from("hotel_memberships").select("auth_user_id,active").eq("hotel_id",hotelId).eq("active",true).in("auth_user_id",targets);
  const allowed=new Set((members||[]).map((m:any)=>m.auth_user_id));const recipientIds=targets.filter(id=>allowed.has(id));
  const {data:profiles}=await admin.from("profiles").select("auth_user_id,display_name").in("auth_user_id",recipientIds);const nameMap=new Map((profiles||[]).map((p:any)=>[p.auth_user_id,p.display_name]));
  const hotelName=HOTEL_NAMES[hotelId]||hotelId;const title=`Nuovo intervento · ${hotelName}`.slice(0,120);const detail=[item.camera,item.categoria,item.note].filter(Boolean).join(" · ").slice(0,500)||"Ti è stato assegnato un intervento";const targetUrl=`/?notification=assignment&hotel_id=${encodeURIComponent(hotelId)}&intervention_id=${encodeURIComponent(interventionId)}`;
  const {data:pushSetting}=await admin.from("integration_settings").select("enabled").eq("key","push_notifications").maybeSingle();
  let pushSent=0,ntfySent=0;
  if(pushSetting?.enabled&&recipientIds.length){
   const {data:subs}=await admin.from("push_subscriptions").select("id,endpoint,p256dh,auth,utente").eq("hotel_id",hotelId).in("utente",recipientIds);
   const {data:secrets}=await admin.from("edge_function_secrets").select("key,value").in("key",["vapid_public","vapid_private","vapid_subject"]);const sm=new Map((secrets||[]).map((r:any)=>[r.key,r.value]));
   if(sm.get("vapid_public")&&sm.get("vapid_private")){webpush.setVapidDetails(sm.get("vapid_subject")||"mailto:appmanutenzioneapice@gmail.com",sm.get("vapid_public"),sm.get("vapid_private"));const expired:string[]=[];
    await Promise.all((subs||[]).map(async(s:any)=>{const rid=String(s.utente);const since=new Date(Date.now()-120000).toISOString();const {data:dup}=await admin.from("notification_outbox").select("id").eq("channel","push").eq("hotel_id",hotelId).eq("recipient",rid).contains("metadata",{event_type:"assignment",intervention_id:interventionId}).gte("created_at",since).limit(1).maybeSingle();if(dup)return;try{await webpush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},JSON.stringify({title,body:detail,tag:`assignment-${interventionId}-${rid}`,url:targetUrl,eventType:"assignment",interventionId,hotelId}));pushSent++;await admin.from("notification_outbox").insert({channel:"push",hotel_id:hotelId,recipient:rid,subject:title,body:detail,status:"sent",sent_at:new Date().toISOString(),metadata:{event_type:"assignment",intervention_id:interventionId,recipient_name:nameMap.get(rid)||null}})}catch(e:any){if(e?.statusCode===404||e?.statusCode===410)expired.push(s.id)}}));if(expired.length)await admin.from("push_subscriptions").delete().in("id",expired);
   }
  }
  const {data:ntfy}=await admin.from("integration_settings").select("enabled,config").eq("key","ntfy_alerts").maybeSingle();
  if(ntfy?.enabled){const server=String(ntfy.config?.server||"https://ntfy.sh").replace(/\/$/,"");for(const rid of recipientIds){const since=new Date(Date.now()-120000).toISOString();const {data:dup}=await admin.from("notification_outbox").select("id").eq("channel","ntfy").eq("hotel_id",hotelId).eq("recipient",rid).contains("metadata",{event_type:"assignment",intervention_id:interventionId}).gte("created_at",since).limit(1).maybeSingle();if(dup)continue;const topic=await personalTopic(hotelId,rid);const res=await fetch(server,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({topic,title,message:detail,priority:4,tags:["wrench","bell"],click:targetUrl})});if(res.ok){ntfySent++;await admin.from("notification_outbox").insert({channel:"ntfy",hotel_id:hotelId,recipient:rid,subject:title,body:detail,status:"sent",sent_at:new Date().toISOString(),metadata:{event_type:"assignment",intervention_id:interventionId,recipient_name:nameMap.get(rid)||null}})}else await admin.from("notification_outbox").insert({channel:"ntfy",hotel_id:hotelId,recipient:rid,subject:title,body:detail,status:"failed",error:`HTTP ${res.status}`,metadata:{event_type:"assignment",intervention_id:interventionId}});}}
  return json({ok:true,status:"sent",recipients:recipientIds.length,push_sent:pushSent,ntfy_sent:ntfySent});
 }catch(error){console.error("assignment-notify",error instanceof Error?error.message:"unknown");return json({ok:false,error:"send_failed"},500)}
});