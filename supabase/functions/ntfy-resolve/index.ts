import { createClient } from "npm:@supabase/supabase-js@2";

const url=Deno.env.get("SUPABASE_URL")!;
const anon=Deno.env.get("SUPABASE_ANON_KEY")!;
const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-randapp-request","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff"}});
const URGENT_ROLES=new Set(["admin","manutentore","Direzione","Direttore Centro Congressi","Reception","Portiere Notturno"]);
const HOTEL_ID:Record<string,string>={GIO:"hotelgio",CHO:"chocohotel",BRI:"brigantino"};
const CHANNEL_ID:Record<string,string>={AV:"urgent",PR:"reminders",IP:"assignments",HK:"housekeeping"};
async function personalTopic(hotelId:string,userId:string){const bytes=new TextEncoder().encode(`randapp-assignment:${hotelId}:${userId}:${service}`);const digest=await crypto.subtle.digest("SHA-256",bytes);const token=Array.from(new Uint8Array(digest)).slice(0,18).map(x=>x.toString(16).padStart(2,"0")).join("");return `randapp-job-${hotelId}-${token}`;}

Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({ok:false,error:"method_not_allowed"},405);
 try{
  const client=createClient(url,anon,{global:{headers:{Authorization:req.headers.get("authorization")||""}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:userData,error:userError}=await client.auth.getUser();
  if(userError||!userData.user)return json({ok:false,error:"unauthorized"},401);
  const body=await req.json().catch(()=>({}));const alias=String(body?.alias||"").trim().toUpperCase();const match=alias.match(/^([A-Z]{3})-(AV|PR|IP|HK)-(\d{6})$/);if(!match)return json({ok:false,error:"invalid_alias"},400);
  const hotelId=HOTEL_ID[match[1]];const channel=CHANNEL_ID[match[2]];const code=match[3];if(!hotelId||!channel)return json({ok:false,error:"invalid_alias"},400);
  const [{data:owned},{data:membership}]=await Promise.all([admin.from("user_notification_codes").select("code").eq("auth_user_id",userData.user.id).eq("code",code).maybeSingle(),admin.from("hotel_memberships").select("role,active").eq("auth_user_id",userData.user.id).eq("hotel_id",hotelId).maybeSingle()]);
  if(!owned)return json({ok:false,error:"alias_not_owned"},403);if(!membership?.active)return json({ok:false,error:"forbidden"},403);
  const role=String(membership.role||"");const [{data:alerts},{data:housekeepingSetting}]=await Promise.all([admin.from("integration_settings").select("enabled,config").eq("key","ntfy_alerts").maybeSingle(),channel==="housekeeping"?admin.from("integration_settings").select("enabled,config").eq("key","ntfy_housekeeping").maybeSingle():Promise.resolve({data:null})]);
  const server=String(alerts?.config?.server||"https://ntfy.sh");let topic="";let label="";
  if(channel==="urgent"){if(!alerts?.enabled||!URGENT_ROLES.has(role))return json({ok:false,error:"forbidden"},403);topic=String(alerts.config?.topics?.[hotelId]||"");label="Avvisi urgenti";}
  else if(channel==="reminders"){if(!alerts?.enabled)return json({ok:false,error:"forbidden"},403);topic=String(alerts.config?.role_topics?.[hotelId]?.[role]||"");label=`Promemoria · ${role}`;}
  else if(channel==="assignments"){if(!alerts?.enabled)return json({ok:false,error:"forbidden"},403);topic=await personalTopic(hotelId,userData.user.id);label="Interventi assegnati a te";}
  else if(channel==="housekeeping"){if(role!=="Capo Governante"||!housekeepingSetting?.enabled)return json({ok:false,error:"forbidden"},403);topic=String(housekeepingSetting.config?.topics?.[hotelId]||"");label="Housekeeping";}
  if(!topic)return json({ok:false,error:"topic_not_configured"},404);
  let host="ntfy.sh";try{host=new URL(server).host}catch{}
  // Native ntfy subscription URI: the app receives only the real topic after
  // authenticated resolution. RandApp's HTTPS short URL is never used as a topic.
  const subscriptionLink=`ntfy://${host}/${encodeURIComponent(topic)}?display=${encodeURIComponent(alias)}`;
  return json({ok:true,alias,hotel_id:hotelId,channel,label,topic,subscription_link:subscriptionLink,deep_link:subscriptionLink});
 }catch(error){console.error("ntfy-resolve",error instanceof Error?error.message:"unknown");return json({ok:false,error:"resolve_failed"},500)}
});
