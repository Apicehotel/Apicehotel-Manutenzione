import { createClient } from "npm:@supabase/supabase-js@2";

const URL=Deno.env.get("SUPABASE_URL")!, ANON=Deno.env.get("SUPABASE_ANON_KEY")!, SERVICE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin=createClient(URL,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
const ALL_HOTELS=["hotelgio","chocohotel","brigantino"];
const normalizeHotels=(value:unknown)=>Array.isArray(value)?[...new Set(value.map(String).filter((hotel)=>ALL_HOTELS.includes(hotel)))]:[];

async function caller(req:Request){
  const token=req.headers.get("authorization")||"";
  const client=createClient(URL,ANON,{global:{headers:{Authorization:token}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await client.auth.getUser();
  if(error||!data.user)throw new Error("UNAUTHORIZED");
  return data.user.id;
}

async function requireAdmin(req:Request,hotels:string[]){
  const uid=await caller(req), wanted=hotels.length?hotels:ALL_HOTELS;
  const {data,error}=await admin.from("hotel_memberships").select("hotel_id,role,active,can_access_admin").eq("auth_user_id",uid).in("hotel_id",wanted);
  if(error)throw error;
  const allowed=new Set((data||[]).filter((row:any)=>row.active&&(row.role==="admin"||row.can_access_admin)).map((row:any)=>row.hotel_id));
  if(!wanted.every((hotel)=>allowed.has(hotel)))throw new Error("FORBIDDEN");
  return uid;
}

async function targetHotels(authUserId:string){
  const {data,error}=await admin.from("hotel_memberships").select("hotel_id,active").eq("auth_user_id",authUserId);
  if(error)throw error;
  return (data||[]).filter((row:any)=>row.active).map((row:any)=>String(row.hotel_id));
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return json({ok:false,error:"Metodo non consentito"},405);
  try{
    const body=await req.json().catch(()=>null), action=String(body?.action||"");
    if(action==="list"){
      const hotels=normalizeHotels(body?.hotels);
      await requireAdmin(req,hotels.length?hotels:ALL_HOTELS);
      const wanted=hotels.length?hotels:ALL_HOTELS;
      const {data:memberships,error:membershipError}=await admin.from("hotel_memberships").select("auth_user_id").in("hotel_id",wanted).eq("active",true);
      if(membershipError)throw membershipError;
      const ids=[...new Set((memberships||[]).map((row:any)=>String(row.auth_user_id)))];
      if(!ids.length)return json({ok:true,settings:[]});
      const {data,error}=await admin.from("profiles").select("auth_user_id,chat_enabled,chat_can_create_groups").in("auth_user_id",ids);
      if(error)throw error;
      return json({ok:true,settings:data||[]});
    }
    if(action==="update"){
      const authUserId=String(body?.auth_user_id||"").trim();
      if(!authUserId)return json({ok:false,error:"Utente mancante"},400);
      const hotels=await targetHotels(authUserId);
      await requireAdmin(req,hotels.length?hotels:ALL_HOTELS);
      const patch:Record<string,boolean>={};
      if(body?.chat_enabled!==undefined)patch.chat_enabled=Boolean(body.chat_enabled);
      if(body?.chat_can_create_groups!==undefined)patch.chat_can_create_groups=Boolean(body.chat_can_create_groups);
      if(!Object.keys(patch).length)return json({ok:false,error:"Nessuna impostazione RandChat da modificare"},400);
      if(patch.chat_enabled===false)patch.chat_can_create_groups=false;
      const {data,error}=await admin.from("profiles").update({...patch,updated_at:new Date().toISOString()}).eq("auth_user_id",authUserId).select("auth_user_id,chat_enabled,chat_can_create_groups").single();
      if(error)throw error;
      return json({ok:true,settings:data});
    }
    return json({ok:false,error:"Azione non valida"},400);
  }catch(error){
    const message=error instanceof Error?error.message:"unknown";
    if(message==="UNAUTHORIZED")return json({ok:false,error:"Non autenticato"},401);
    if(message==="FORBIDDEN")return json({ok:false,error:"Permesso amministratore richiesto"},403);
    console.error("admin-chat-settings",message);
    return json({ok:false,error:message||"Errore impostazioni RandChat"},500);
  }
});
