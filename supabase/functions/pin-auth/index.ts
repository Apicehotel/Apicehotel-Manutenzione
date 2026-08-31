import { createClient } from "npm:@supabase/supabase-js@2";
import bcrypt from "npm:bcryptjs@2.4.3";

const URL=Deno.env.get("SUPABASE_URL")!, ANON=Deno.env.get("SUPABASE_ANON_KEY")!, SERVICE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin=createClient(URL,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"GET, POST, OPTIONS"};
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
const ROLE_VALUES=new Set(["admin","Supremo","Direzione","Direttore Centro Congressi","Portiere Notturno","Responsabile","manutentore","Tecnico esterno","Governante","Capo Governante","Reception","Isola dei Golosi","Ristorante Wine/Jazz","Colazione Jazz"]);
const canonicalRole=(v:unknown)=>{const r=String(v||"Reception").trim();return ROLE_VALUES.has(r)?r:"Reception"};
const PRESENCE_MAX_MS=(7*60+20)*60*1000;

async function activeMember(req:Request,hotelId:string){
  const header=req.headers.get("authorization")||"";
  const token=header.replace(/^Bearer\s+/i,"").trim();
  if(!token)return null;
  const {data,error}=await admin.auth.getUser(token);
  if(error||!data?.user?.id)return null;
  const {data:membership}=await admin.from("hotel_memberships").select("active").eq("auth_user_id",data.user.id).eq("hotel_id",hotelId).maybeSingle();
  return membership?.active?data.user.id:null;
}

async function listLoginDirectory(hotelId:string){
  const {data,error}=await admin.from("utenti").select("id,nome,active,is_system_protected,hotels").eq("active",true).neq("ruolo","RandAI").or('is_system_protected.eq.false,nome.eq.Randagio').contains("hotels",[hotelId]).order("nome");
  if(error)throw error;
  return(data||[]).map((u:any)=>({id:u.id,legacy_id:u.id,name:u.nome,hotel_id:hotelId,active:true}));
}

async function listOperationalDirectory(hotelId:string){
  const {data,error}=await admin.from("utenti").select("id,nome,ruolo,department,hotels,active,is_system_protected,in_struttura,in_struttura_dal,telefono,phone_country_code").eq("active",true).or('is_system_protected.eq.false,nome.eq.Randagio').contains("hotels",[hotelId]).order("nome");
  if(error)throw error;
  const legacyIds=(data||[]).map((u:any)=>u.id);
  const {data:profiles}=legacyIds.length?await admin.from("profiles").select("auth_user_id,legacy_user_id,email").in("legacy_user_id",legacyIds):{data:[] as any[]};
  const profileByLegacy=new Map((profiles||[]).map((p:any)=>[p.legacy_user_id,p]));
  const authIds=(profiles||[]).map((p:any)=>p.auth_user_id);
  const {data:memberships}=authIds.length?await admin.from("hotel_memberships").select("auth_user_id,role,active,can_access_admin").eq("hotel_id",hotelId).in("auth_user_id",authIds):{data:[] as any[]};
  const membershipByAuth=new Map((memberships||[]).map((m:any)=>[m.auth_user_id,m]));
  return(data||[]).map((u:any)=>{const p:any=profileByLegacy.get(u.id)||null,authId=p?.auth_user_id||null,m:any=authId?membershipByAuth.get(authId):null,since=u.in_struttura_dal?new Date(u.in_struttura_dal).getTime():null,expired=since!==null&&Date.now()-since>PRESENCE_MAX_MS,role=canonicalRole(m?.role||u.ruolo);return{id:authId||u.id,legacy_id:u.id,auth_user_id:authId,name:u.nome,role,department:u.department||null,hotels:u.hotels||[hotelId],hotel_id:hotelId,active:m?Boolean(m.active):true,can_admin:Boolean(m?.can_access_admin)||role==="admin",in_struttura:Boolean(u.in_struttura)&&!expired,in_struttura_dal:u.in_struttura_dal||null,email:p?.email||null,phone:u.telefono||null,phone_country_code:u.phone_country_code||"+39"}});
}

async function listDirectory(req:Request,hotelId:string){
  return await activeMember(req,hotelId)?listOperationalDirectory(hotelId):listLoginDirectory(hotelId);
}

async function resolveLegacyUserId(userId:string){const {data,error}=await admin.from("profiles").select("legacy_user_id").eq("auth_user_id",userId).maybeSingle();if(error)throw error;return data?.legacy_user_id?String(data.legacy_user_id):userId}

async function ensureIdentity(legacy:any,pin:string){
  const {data:existing}=await admin.from("profiles").select("auth_user_id,active,is_system_protected").eq("legacy_user_id",legacy.id).maybeSingle();
  if(existing?.is_system_protected&&legacy.nome!=="Randagio")throw new Error("PROTECTED");
  if(existing&&existing.active===false)throw new Error("INACTIVE");
  let authUserId=existing?.auth_user_id as string|undefined;
  const internalEmail=legacy.is_system_protected&&legacy.nome==="Randagio"?`system-randagio-${legacy.id}@auth.apicehotel.invalid`:`u-${legacy.id}@auth.apicehotel.invalid`;
  if(!authUserId){const password=crypto.randomUUID()+crypto.randomUUID();const {data:created,error}=await admin.auth.admin.createUser({email:internalEmail,password,email_confirm:true,user_metadata:{legacy_user_id:legacy.id,display_name:legacy.nome}});if(error||!created.user)throw error||new Error("Creazione identità fallita");authUserId=created.user.id}
  const now=new Date().toISOString();
  let e=(await admin.from("profiles").upsert({auth_user_id:authUserId,legacy_user_id:legacy.id,display_name:legacy.nome,department:legacy.department||null,phone:legacy.telefono||null,phone_country_code:legacy.phone_country_code||"+39",email:legacy.email||null,phone_verified:Boolean(legacy.phone_verified),email_verified:Boolean(legacy.email_verified),active:true,is_system_protected:Boolean(legacy.is_system_protected),updated_at:now},{onConflict:"auth_user_id"})).error;if(e)throw e;
  const {data:credential}=await admin.from("auth_pin_credentials").select("auth_user_id").eq("auth_user_id",authUserId).maybeSingle();
  if(!credential){const hash=await bcrypt.hash(pin,11);e=(await admin.from("auth_pin_credentials").insert({auth_user_id:authUserId,pin_hash:hash,must_change_pin:Boolean(legacy.deve_cambiare_pin),failed_attempts:0})).error;if(e)throw e}
  const hotels=Array.isArray(legacy.hotels)?legacy.hotels:[];
  if(hotels.length){const {data:existingMemberships,error:readError}=await admin.from("hotel_memberships").select("hotel_id").eq("auth_user_id",authUserId);if(readError)throw readError;const existingHotels=new Set((existingMemberships||[]).map((r:any)=>String(r.hotel_id)));const rows=hotels.filter((h:string)=>!existingHotels.has(h)).map((hotel_id:string)=>({auth_user_id:authUserId,hotel_id,role:canonicalRole(legacy.ruolo),active:true,can_access_admin:Boolean(legacy.puo_admin)||canonicalRole(legacy.ruolo)==="admin"}));if(rows.length){e=(await admin.from("hotel_memberships").insert(rows)).error;if(e)throw e}}
  return{authUserId,internalEmail};
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  try{
    if(req.method==="GET"){const hotelId=new URL(req.url).searchParams.get("hotel_id")?.trim();if(!hotelId)return json({ok:false,error:"hotel_id mancante"},400);return json({ok:true,users:await listDirectory(req,hotelId)})}
    if(req.method!=="POST")return json({ok:false,error:"Metodo non consentito"},405);
    const body=await req.json().catch(()=>null),action=String(body?.action||"login"),hotelId=String(body?.hotel_id||"").trim();
    if(action==="directory"){if(!hotelId)return json({ok:false,error:"hotel_id mancante"},400);return json({ok:true,users:await listDirectory(req,hotelId)})}
    const userId=String(body?.user_id||"").trim(),pin=String(body?.pin||"").trim();
    if(!hotelId||!userId||!/^\d{4}$/.test(pin))return json({ok:false,error:"Dati login non validi"},400);
    const legacyUserId=await resolveLegacyUserId(userId);
    const {data:legacy,error:legacyError}=await admin.from("utenti").select("id,nome,ruolo,pin,hotels,puo_admin,department,telefono,email,phone_country_code,phone_verified,email_verified,deve_cambiare_pin,active,is_system_protected,in_struttura,in_struttura_dal").eq("id",legacyUserId).eq("active",true).or('is_system_protected.eq.false,nome.eq.Randagio').contains("hotels",[hotelId]).maybeSingle();
    if(legacyError||!legacy)return json({ok:false,error:"Utente o PIN non validi"},401);
    const {data:existingProfile}=await admin.from("profiles").select("auth_user_id,active").eq("legacy_user_id",legacy.id).maybeSingle();
    if(existingProfile?.active===false)return json({ok:false,error:"Utente disattivato"},403);
    if(existingProfile?.auth_user_id){const {data:credential}=await admin.from("auth_pin_credentials").select("pin_hash,failed_attempts,locked_until").eq("auth_user_id",existingProfile.auth_user_id).maybeSingle();if(credential?.locked_until&&new Date(credential.locked_until).getTime()>Date.now())return json({ok:false,error:"Troppi tentativi. Riprova più tardi."},429);const valid=credential?.pin_hash?await bcrypt.compare(pin,credential.pin_hash):Boolean(legacy.pin&&String(legacy.pin)===pin);if(!valid){const failures=Number(credential?.failed_attempts||0)+1,patch:Record<string,unknown>={failed_attempts:failures};if(failures>=5){patch.failed_attempts=0;patch.locked_until=new Date(Date.now()+10*60*1000).toISOString()}if(credential)await admin.from("auth_pin_credentials").update(patch).eq("auth_user_id",existingProfile.auth_user_id);return json({ok:false,error:"Utente o PIN non validi"},401)}}else if(!legacy.pin||String(legacy.pin)!==pin)return json({ok:false,error:"Utente o PIN non validi"},401);
    const {authUserId,internalEmail}=await ensureIdentity(legacy,pin);await admin.from("auth_pin_credentials").update({failed_attempts:0,locked_until:null}).eq("auth_user_id",authUserId);
    const {data:membership}=await admin.from("hotel_memberships").select("role,active,can_access_admin").eq("auth_user_id",authUserId).eq("hotel_id",hotelId).maybeSingle();if(!membership?.active)return json({ok:false,error:"Accesso alla struttura non consentito"},403);
    const password=crypto.randomUUID()+crypto.randomUUID();const {error:passwordError}=await admin.auth.admin.updateUserById(authUserId,{password});if(passwordError)throw passwordError;const client=createClient(URL,ANON,{auth:{persistSession:false,autoRefreshToken:false}});const {data:signed,error:signError}=await client.auth.signInWithPassword({email:internalEmail,password});if(signError||!signed.session)throw signError||new Error("Sessione non disponibile");
    const since=legacy.in_struttura_dal?new Date(legacy.in_struttura_dal).getTime():null,presenceExpired=since!==null&&Date.now()-since>PRESENCE_MAX_MS,role=canonicalRole(membership.role);
    return json({ok:true,session:{access_token:signed.session.access_token,refresh_token:signed.session.refresh_token,expires_at:signed.session.expires_at},user:{id:authUserId,legacy_id:legacy.id,auth_user_id:authUserId,name:legacy.nome,role,can_admin:Boolean(membership.can_access_admin)||role==="admin",hotel_id:hotelId,department:legacy.department||null,email:legacy.email||null,phone:legacy.telefono||null,phone_country_code:legacy.phone_country_code||"+39",hotels:legacy.hotels||[hotelId],protected:Boolean(legacy.is_system_protected),active:true,in_struttura:Boolean(legacy.in_struttura)&&!presenceExpired,in_struttura_dal:legacy.in_struttura_dal||null}});
  }catch(error){const m=error instanceof Error?error.message:"unknown";if(m==="INACTIVE")return json({ok:false,error:"Utente disattivato"},403);if(m==="PROTECTED")return json({ok:false,error:"Account Admin accessibile solo dal pannello Admin"},403);console.error("pin-auth",m);return json({ok:false,error:"Errore temporaneo di accesso"},500)}
});