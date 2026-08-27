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

    const housekeeping=body?.channel==="housekeeping";
    const allowed=housekeeping?HOUSEKEEPING_SEND_ROLES.has(membership.role):URGENT_ROLES.has(membership.role);
    if(!allowed) return json({ok:false,error:"forbidden"},403);

    const settingKey=housekeeping?"ntfy_housekeeping":"ntfy_alerts";
    const {data:setting}=await admin.from("integration_settings").select("enabled,config").eq("key",settingKey).maybeSingle();
    if(!setting?.enabled) return json({ok:true,enabled:false,status:"disabled",channel:housekeeping?"housekeeping":"urgent"});
    const server=String(setting.config?.server||"https://ntfy.sh").replace(/\/$/,"");
    const topic=String(setting.config?.topics?.[hotelId]||"");
    if(!topic) return json({ok:false,error:"topic_not_configured"},404);
    const test=body?.test===true;
    const title=test
      ? `TEST RandApp · ${HOTEL_NAMES[hotelId]||hotelId}`
      : String(body?.title||(housekeeping?`Housekeeping · ${HOTEL_NAMES[hotelId]||hotelId}`:`ALLARME · ${HOTEL_NAMES[hotelId]||hotelId}`)).slice(0,120);
    const message=test
      ? (housekeeping?"Test ntfy Housekeeping riuscito. Riceverai qui le modifiche operative di Direzione e Reception.":"Test ntfy riuscito. Il secondo canale di allarme è configurato su questo dispositivo.")
      : String(body?.message||(housekeeping?"Modifica Housekeeping in RandApp":"Nuovo avviso urgente in RandApp")).slice(0,500);
    const publishBody:Record<string,unknown>={
      topic,
      title,
      message,
      priority:test?5:Math.max(1,Math.min(5,Number(body?.priority)||(housekeeping?4:5))),
      tags:housekeeping?["broom","hotel"]:(test?["white_check_mark","bell"]:["rotating_light","warning"]),
    };
    if(body?.url) publishBody.click=String(body.url).slice(0,1000);
    const res=await fetch(server,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(publishBody)});
    if(!res.ok){const text=await res.text().catch(()=>"");console.error("ntfy-alert delivery",res.status,text.slice(0,500));return json({ok:false,error:"delivery_failed",status:res.status,detail:text.slice(0,160)},502)}
    const delivered=await res.json().catch(()=>({}));
    return json({ok:true,status:"sent",id:delivered?.id||null,time:delivered?.time||null,test,channel:housekeeping?"housekeeping":"urgent"});
  }catch(error){console.error("ntfy-alert",error instanceof Error?error.message:"unknown");return json({ok:false,error:"send_failed"},500)}
});
