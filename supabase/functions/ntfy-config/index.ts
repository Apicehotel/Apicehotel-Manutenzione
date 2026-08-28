import { createClient } from "npm:@supabase/supabase-js@2";

const url=Deno.env.get("SUPABASE_URL")!;
const anon=Deno.env.get("SUPABASE_ANON_KEY")!;
const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-randapp-request","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
const URGENT_ROLES=new Set(["admin","manutentore","Direzione","Direttore Centro Congressi","Reception","Portiere Notturno"]);
const APPS={ios:"https://apps.apple.com/it/app/ntfy/id1625396347",android:"https://play.google.com/store/apps/details?id=io.heckel.ntfy",web:"https://ntfy.sh/app"};
async function personalTopic(hotelId:string,userId:string){const bytes=new TextEncoder().encode(`randapp-assignment:${hotelId}:${userId}:${service}`);const digest=await crypto.subtle.digest("SHA-256",bytes);const token=Array.from(new Uint8Array(digest)).slice(0,18).map(x=>x.toString(16).padStart(2,"0")).join("");return `randapp-job-${hotelId}-${token}`;}

Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({ok:false,error:"method_not_allowed"},405);
 try{
  const client=createClient(url,anon,{global:{headers:{Authorization:req.headers.get("authorization")||""}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:userData,error:userError}=await client.auth.getUser();
  if(userError||!userData.user)return json({ok:false,error:"unauthorized"},401);
  const body=await req.json().catch(()=>({}));const hotelId=String(body?.hotel_id||"").trim();if(!hotelId)return json({ok:false,error:"hotel_id_required"},400);
  const {data:membership}=await admin.from("hotel_memberships").select("role,active").eq("auth_user_id",userData.user.id).eq("hotel_id",hotelId).maybeSingle();if(!membership?.active)return json({ok:false,error:"forbidden"},403);
  const role=String(membership.role||"");const [{data:alerts},{data:housekeepingSetting}]=await Promise.all([admin.from("integration_settings").select("enabled,config").eq("key","ntfy_alerts").maybeSingle(),role==="Capo Governante"?admin.from("integration_settings").select("enabled,config").eq("key","ntfy_housekeeping").maybeSingle():Promise.resolve({data:null})]);
  const alertServer=String(alerts?.config?.server||"https://ntfy.sh");const urgentTopic=alerts?.enabled&&URGENT_ROLES.has(role)?String(alerts.config?.topics?.[hotelId]||""):"";const reminderTopic=alerts?.enabled?String(alerts.config?.role_topics?.[hotelId]?.[role]||""):"";const assignmentTopic=alerts?.enabled?await personalTopic(hotelId,userData.user.id):"";const housekeepingTopic=role==="Capo Governante"&&housekeepingSetting?.enabled?String(housekeepingSetting.config?.topics?.[hotelId]||""):"";
  const channels=[urgentTopic?{id:"urgent",label:"Avvisi urgenti",topic:urgentTopic,priority:5}:null,reminderTopic?{id:"reminders",label:`Promemoria · ${role}`,topic:reminderTopic,priority:5}:null,assignmentTopic?{id:"assignments",label:"Interventi assegnati a te",topic:assignmentTopic,priority:4}:null,housekeepingTopic?{id:"housekeeping",label:"Housekeeping",topic:housekeepingTopic,priority:5}:null].filter(Boolean);
  if(!channels.length)return json({ok:true,enabled:false,role,channels:[],apps:APPS});const primary=channels[0] as any;
  return json({ok:true,enabled:true,server:alertServer,role,channels,apps:APPS,topic:primary.topic,channel:primary.id,reminder_topic:reminderTopic||null,urgent_topic:urgentTopic||null,assignment_topic:assignmentTopic||null,housekeeping_topic:housekeepingTopic||null});
 }catch(error){console.error("ntfy-config",error instanceof Error?error.message:"unknown");return json({ok:false,error:"config_failed"},500)}
});