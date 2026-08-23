import { createClient } from "npm:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(url, service, { auth: { persistSession:false, autoRefreshToken:false } });
const cors = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods":"POST, OPTIONS" };
const json = (body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
const ALLOWED_ROLES = new Set(["admin","manutentore","Direzione","Direttore Centro Congressi","Reception","Portiere Notturno"]);
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
    if(!membership?.active||!ALLOWED_ROLES.has(membership.role)) return json({ok:false,error:"forbidden"},403);
    const {data:setting}=await admin.from("integration_settings").select("enabled,config").eq("key","ntfy_alerts").maybeSingle();
    if(!setting?.enabled) return json({ok:true,enabled:false,status:"disabled"});
    const server=String(setting.config?.server||"https://ntfy.sh").replace(/\/$/,"");
    const topic=String(setting.config?.topics?.[hotelId]||"");
    if(!topic) return json({ok:false,error:"topic_not_configured"},404);
    const test=body?.test===true;
    const title=test?`TEST RandApp · ${HOTEL_NAMES[hotelId]||hotelId}`:String(body?.title||`ALLARME · ${HOTEL_NAMES[hotelId]||hotelId}`).slice(0,120);
    const message=test?"Test ntfy riuscito. Il secondo canale di allarme è configurato su questo dispositivo.":String(body?.message||"Nuovo avviso urgente in RandApp").slice(0,500);
    const headers:Record<string,string>={"Title":title,"Priority":test?"5":String(body?.priority||"5"),"Tags":test?"white_check_mark,bell":"rotating_light,warning"};
    if(body?.url) headers["Click"]=String(body.url).slice(0,1000);
    const res=await fetch(`${server}/${encodeURIComponent(topic)}`,{method:"POST",headers,body:message});
    if(!res.ok){const text=await res.text().catch(()=>"");console.error("ntfy-alert",res.status,text.slice(0,200));return json({ok:false,error:"delivery_failed",status:res.status},502)}
    const delivered=await res.json().catch(()=>({}));
    return json({ok:true,status:"sent",id:delivered?.id||null,time:delivered?.time||null,test});
  }catch(error){console.error("ntfy-alert",error instanceof Error?error.message:"unknown");return json({ok:false,error:"send_failed"},500)}
});
