import { createClient } from "npm:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(url, service, { auth: { persistSession:false, autoRefreshToken:false } });
const cors = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-randapp-request", "Access-Control-Allow-Methods":"POST, OPTIONS" };
const json = (body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
const URGENT_ROLES = new Set(["admin","manutentore","Direzione","Direttore Centro Congressi","Reception","Portiere Notturno"]);
const HOUSEKEEPING_SEND_ROLES = new Set(["admin","Direzione","Reception"]);
const HOTEL_NAMES:Record<string,string>={hotelgio:"Hotel Giò",chocohotel:"Chocohotel",brigantino:"Hotel Il Brigantino"};
async function personalTopic(hotelId:string,userId:string){const bytes=new TextEncoder().encode(`randapp-assignment:${hotelId}:${userId}:${service}`);const digest=await crypto.subtle.digest("SHA-256",bytes);const token=Array.from(new Uint8Array(digest)).slice(0,18).map(x=>x.toString(16).padStart(2,"0")).join("");return `randapp-job-${hotelId}-${token}`;}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  if(req.method!=="POST") return json({ok:false,error:"method_not_allowed"},405);
  try{
    const client=createClient(url,anon,{global:{headers:{Authorization:req.headers.get("authorization")||""}},auth:{persistSession:false,autoRefreshToken:false}});
    const {data:userData,error:userError}=await client.auth.getUser();
    if(userError||!userData.user) return json({ok:false,error:"unauthorized"},401);
    const body=await req.json().catch(()=>({}));
    const hotelId=String(body?.hotel_id||"").trim();
    if(!hotelId) return json({ok:false,error:"hotel_id_required"},400);
    const {data:membership}=await admin.from("hotel_memberships").select("role,active").eq("auth_user_id",userData.user.id).eq("hotel_id",hotelId).maybeSingle();
    if(!membership?.active) return json({ok:false,error:"forbidden"},403);
    const test=body?.test===true;const channel=String(body?.channel||"urgent");const role=String(membership.role||"");const housekeeping=channel==="housekeeping";const reminders=channel==="reminders";const assignments=channel==="assignments";
    if((reminders||assignments)&&!test) return json({ok:false,error:"forbidden"},403);
    if(housekeeping && !(HOUSEKEEPING_SEND_ROLES.has(role)||(test&&role==="Capo Governante"))) return json({ok:false,error:"forbidden"},403);
    if(!housekeeping&&!reminders&&!assignments&&!URGENT_ROLES.has(role)) return json({ok:false,error:"forbidden"},403);
    const settingKey=housekeeping?"ntfy_housekeeping":"ntfy_alerts";const {data:setting}=await admin.from("integration_settings").select("enabled,config").eq("key",settingKey).maybeSingle();if(!setting?.enabled)return json({ok:true,enabled:false,status:"disabled",channel});
    const server=String(setting.config?.server||"https://ntfy.sh").replace(/\/$/,"");const topic=assignments?await personalTopic(hotelId,userData.user.id):reminders?String(setting.config?.role_topics?.[hotelId]?.[role]||""):String(setting.config?.topics?.[hotelId]||"");if(!topic)return json({ok:false,error:"topic_not_configured"},404);
    const title=test?(assignments?`TEST Interventi · ${HOTEL_NAMES[hotelId]||hotelId}`:reminders?`TEST Promemoria · ${HOTEL_NAMES[hotelId]||hotelId}`:housekeeping?`TEST Housekeeping · ${HOTEL_NAMES[hotelId]||hotelId}`:`TEST Avvisi · ${HOTEL_NAMES[hotelId]||hotelId}`):String(body?.title||(housekeeping?`Housekeeping · ${HOTEL_NAMES[hotelId]||hotelId}`:`ALLARME · ${HOTEL_NAMES[hotelId]||hotelId}`)).slice(0,120);
    const message=test?(assignments?"Canale personale degli interventi configurato correttamente.":reminders?`Canale Promemoria ${role} configurato correttamente.`:housekeeping?"Canale ntfy Housekeeping configurato correttamente.":"Canale ntfy Avvisi Urgenti configurato correttamente."):String(body?.message||(housekeeping?"Modifica Housekeeping in RandApp":"Nuovo avviso urgente in RandApp")).slice(0,500);
    // Priority 5 is intentionally reserved for genuine urgent alerts. Test messages never trigger it.
    const priority=test?3:assignments?4:reminders?3:housekeeping?3:5;
    const publishBody:Record<string,unknown>={topic,title,message,priority,tags:assignments?["wrench","bell"]:reminders?["bell","memo"]:housekeeping?["broom","hotel"]:(test?["white_check_mark","bell"]:["rotating_light","warning"])};if(body?.url)publishBody.click=String(body.url).slice(0,1000);
    const res=await fetch(server,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(publishBody)});if(!res.ok){const text=await res.text().catch(()=>"");console.error("ntfy-alert delivery",res.status,text.slice(0,500));return json({ok:false,error:"delivery_failed",status:res.status,detail:text.slice(0,160)},502)}const delivered=await res.json().catch(()=>({}));return json({ok:true,status:"sent",id:delivered?.id||null,time:delivered?.time||null,test,channel,priority});
  }catch(error){console.error("ntfy-alert",error instanceof Error?error.message:"unknown");return json({ok:false,error:"send_failed"},500)}
});