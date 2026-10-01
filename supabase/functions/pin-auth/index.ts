import postgres from "npm:postgres@3.4.7";
import bcrypt from "npm:bcryptjs@2.4.3";

const API_URL=Deno.env.get("SUPABASE_URL")!;
const DB=Deno.env.get("SUPABASE_DB_URL")!;

function namedKey(envName:string, legacyName:string){
  const raw=Deno.env.get(envName);
  if(raw){
    try{
      const parsed=JSON.parse(raw);
      return String(parsed?.default || Object.values(parsed||{})[0] || "");
    }catch{}
  }
  return Deno.env.get(legacyName) || "";
}

const SECRET=namedKey("SUPABASE_SECRET_KEYS","SUPABASE_SERVICE_ROLE_KEY");
const PUBLIC=namedKey("SUPABASE_PUBLISHABLE_KEYS","SUPABASE_ANON_KEY");
const sql=postgres(DB,{prepare:false,max:2,connect_timeout:5,idle_timeout:10});

const cors={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"GET, POST, OPTIONS",
};
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});

const ROLE_VALUES=new Set(["admin","Supremo","Direzione","Direttore Centro Congressi","Portiere Notturno","Responsabile","manutentore","Tecnico esterno","Governante","Capo Governante","Reception","Isola dei Golosi","Ristorante Wine/Jazz","Colazione Jazz"]);
const canonicalRole=(v:unknown)=>{const r=String(v||"Reception").trim();return ROLE_VALUES.has(r)?r:"Reception"};
const PRESENCE_MAX_MS=(7*60+20)*60*1000;

function hotelList(value:any):string[]{
  if(Array.isArray(value)) return value.map(String);
  if(typeof value==="string"){
    try{const parsed=JSON.parse(value);if(Array.isArray(parsed))return parsed.map(String)}catch{}
    if(value.startsWith("{")&&value.endsWith("}"))return value.slice(1,-1).split(",").map((x)=>x.replace(/^"|"$/g,"").trim()).filter(Boolean);
  }
  return [];
}
const hasHotel=(value:any,hotelId:string)=>hotelList(value).includes(hotelId);

async function authJson(path:string,method="GET",body?:unknown,key=SECRET,token?:string){
  const headers:Record<string,string>={apikey:key,Accept:"application/json"};
  if(body!==undefined) headers["Content-Type"]="application/json";
  if(token) headers.Authorization=`Bearer ${token}`;
  const response=await fetch(`${API_URL}/auth/v1${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  const text=await response.text();
  let payload:any=null;
  try{payload=text?JSON.parse(text):null}catch{payload={message:text}}
  if(!response.ok){
    const err=new Error(String(payload?.msg||payload?.message||payload?.error_description||payload?.error||`Auth ${response.status}`));
    (err as any).status=response.status;
    (err as any).payload=payload;
    throw err;
  }
  return payload;
}

async function activeMember(req:Request,hotelId:string){
  const header=req.headers.get("authorization")||"";
  const token=header.replace(/^Bearer\s+/i,"").trim();
  if(!token)return null;
  let user:any;
  try{user=await authJson("/user","GET",undefined,PUBLIC,token)}catch{return null}
  if(!user?.id)return null;
  const rows=await sql`select active from public.hotel_memberships where auth_user_id=${user.id}::uuid and hotel_id=${hotelId} limit 1`;
  return rows[0]?.active?String(user.id):null;
}

async function listLoginDirectory(hotelId:string){
  const rows=await sql`select id,nome,active,is_system_protected,hotels from public.utenti where active=true and ruolo <> 'RandAI' order by nome`;
  return rows
    .filter((u:any)=>(u.is_system_protected===false||u.nome==="Randagio")&&hasHotel(u.hotels,hotelId))
    .map((u:any)=>({id:String(u.id),legacy_id:String(u.id),name:u.nome,hotel_id:hotelId,active:true}));
}

async function listOperationalDirectory(hotelId:string){
  const data=await sql`select id,nome,ruolo,department,hotels,active,is_system_protected,in_struttura,in_struttura_dal,telefono,phone_country_code from public.utenti where active=true order by nome`;
  const filtered=data.filter((u:any)=>(u.is_system_protected===false||u.nome==="Randagio")&&hasHotel(u.hotels,hotelId));
  const profiles=await sql`select auth_user_id,legacy_user_id,email from public.profiles`;
  const memberships=await sql`select auth_user_id,role,active,can_access_admin from public.hotel_memberships where hotel_id=${hotelId}`;
  const profileByLegacy=new Map(profiles.map((p:any)=>[String(p.legacy_user_id),p]));
  const membershipByAuth=new Map(memberships.map((m:any)=>[String(m.auth_user_id),m]));
  return filtered.map((u:any)=>{
    const p:any=profileByLegacy.get(String(u.id))||null;
    const authId=p?.auth_user_id?String(p.auth_user_id):null;
    const m:any=authId?membershipByAuth.get(authId):null;
    const since=u.in_struttura_dal?new Date(u.in_struttura_dal).getTime():null;
    const expired=since!==null&&Date.now()-since>PRESENCE_MAX_MS;
    const role=canonicalRole(m?.role||u.ruolo);
    return {id:authId||String(u.id),legacy_id:String(u.id),auth_user_id:authId,name:u.nome,role,department:u.department||null,hotels:hotelList(u.hotels).length?hotelList(u.hotels):[hotelId],hotel_id:hotelId,active:m?Boolean(m.active):true,can_admin:Boolean(m?.can_access_admin)||role==="admin",in_struttura:Boolean(u.in_struttura)&&!expired,in_struttura_dal:u.in_struttura_dal||null,email:p?.email||null,phone:u.telefono||null,phone_country_code:u.phone_country_code||"+39"};
  });
}

async function listDirectory(req:Request,hotelId:string){
  return await activeMember(req,hotelId)?listOperationalDirectory(hotelId):listLoginDirectory(hotelId);
}

async function resolveLegacyUserId(userId:string){
  const rows=await sql`select legacy_user_id from public.profiles where auth_user_id=${userId}::uuid limit 1`.catch(()=>[]);
  return rows[0]?.legacy_user_id?String(rows[0].legacy_user_id):userId;
}

async function ensureIdentity(legacy:any,pin:string){
  const existingRows=await sql`select auth_user_id,active,is_system_protected from public.profiles where legacy_user_id=${legacy.id}::uuid limit 1`;
  const existing:any=existingRows[0]||null;
  if(existing?.is_system_protected&&legacy.nome!=="Randagio")throw new Error("PROTECTED");
  if(existing&&existing.active===false)throw new Error("INACTIVE");
  let authUserId=existing?.auth_user_id?String(existing.auth_user_id):undefined;
  const internalEmail=legacy.is_system_protected&&legacy.nome==="Randagio"
    ?`system-randagio-${legacy.id}@auth.apicehotel.invalid`
    :`u-${legacy.id}@auth.apicehotel.invalid`;

  if(!authUserId){
    const password=crypto.randomUUID()+crypto.randomUUID();
    const created=await authJson("/admin/users","POST",{email:internalEmail,password,email_confirm:true,user_metadata:{legacy_user_id:String(legacy.id),display_name:legacy.nome}});
    if(!created?.id)throw new Error("Creazione identità fallita");
    authUserId=String(created.id);
  }

  if(!existing){
    await sql`insert into public.profiles (auth_user_id,legacy_user_id,display_name,department,phone,phone_country_code,email,phone_verified,email_verified,active,is_system_protected,updated_at)
      values (${authUserId}::uuid,${legacy.id}::uuid,${legacy.nome},${legacy.department||null},${legacy.telefono||null},${legacy.phone_country_code||"+39"},${legacy.email||null},${Boolean(legacy.phone_verified)},${Boolean(legacy.email_verified)},true,${Boolean(legacy.is_system_protected)},now())`;
  }

  const credentials=await sql`select auth_user_id from public.auth_pin_credentials where auth_user_id=${authUserId}::uuid limit 1`;
  if(!credentials[0]){
    const hash=await bcrypt.hash(pin,11);
    await sql`insert into public.auth_pin_credentials (auth_user_id,pin_hash,must_change_pin,failed_attempts) values (${authUserId}::uuid,${hash},${Boolean(legacy.deve_cambiare_pin)},0)`;
  }

  const memberships=await sql`select hotel_id from public.hotel_memberships where auth_user_id=${authUserId}::uuid`;
  const existingHotels=new Set(memberships.map((r:any)=>String(r.hotel_id)));
  for(const hotelId of hotelList(legacy.hotels)){
    if(existingHotels.has(hotelId))continue;
    await sql`insert into public.hotel_memberships (auth_user_id,hotel_id,role,active,can_access_admin)
      values (${authUserId}::uuid,${hotelId},${canonicalRole(legacy.ruolo)},true,${Boolean(legacy.puo_admin)||canonicalRole(legacy.ruolo)==="admin"})`;
  }
  return {authUserId,internalEmail};
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  try{
    if(req.method==="GET"){
      const hotelId=new URL(req.url).searchParams.get("hotel_id")?.trim();
      if(!hotelId)return json({ok:false,error:"hotel_id mancante"},400);
      return json({ok:true,users:await listDirectory(req,hotelId)});
    }
    if(req.method!=="POST")return json({ok:false,error:"Metodo non consentito"},405);
    const body=await req.json().catch(()=>null);
    const action=String(body?.action||"login");
    const hotelId=String(body?.hotel_id||"").trim();
    if(action==="directory"){
      if(!hotelId)return json({ok:false,error:"hotel_id mancante"},400);
      return json({ok:true,users:await listDirectory(req,hotelId)});
    }

    const userId=String(body?.user_id||"").trim();
    const pin=String(body?.pin||"").trim();
    if(!hotelId||!userId||!/^\d{4}$/.test(pin))return json({ok:false,error:"Dati login non validi"},400);

    const legacyUserId=await resolveLegacyUserId(userId);
    const legacyRows=await sql`select id,nome,ruolo,pin,hotels,puo_admin,department,telefono,email,phone_country_code,phone_verified,email_verified,deve_cambiare_pin,active,is_system_protected,in_struttura,in_struttura_dal from public.utenti where id=${legacyUserId}::uuid and active=true limit 1`;
    const legacy:any=legacyRows[0]||null;
    if(!legacy||(legacy.is_system_protected&&legacy.nome!=="Randagio")||!hasHotel(legacy.hotels,hotelId))return json({ok:false,error:"Utente o PIN non validi"},401);

    const profileRows=await sql`select auth_user_id,active from public.profiles where legacy_user_id=${legacy.id}::uuid limit 1`;
    const existingProfile:any=profileRows[0]||null;
    if(existingProfile?.active===false)return json({ok:false,error:"Utente disattivato"},403);

    if(existingProfile?.auth_user_id){
      const credentialRows=await sql`select pin_hash,failed_attempts,locked_until from public.auth_pin_credentials where auth_user_id=${existingProfile.auth_user_id}::uuid limit 1`;
      const credential:any=credentialRows[0]||null;
      if(credential?.locked_until&&new Date(credential.locked_until).getTime()>Date.now())return json({ok:false,error:"Troppi tentativi. Riprova più tardi."},429);
      if(!credential?.pin_hash)throw new Error("CREDENTIAL_REQUIRED");
      const valid=await bcrypt.compare(pin,credential.pin_hash);
      if(!valid){
        const failures=Number(credential?.failed_attempts||0)+1;
        if(credential){
          if(failures>=5)await sql`update public.auth_pin_credentials set failed_attempts=0,locked_until=${new Date(Date.now()+10*60*1000).toISOString()}::timestamptz where auth_user_id=${existingProfile.auth_user_id}::uuid`;
          else await sql`update public.auth_pin_credentials set failed_attempts=${failures} where auth_user_id=${existingProfile.auth_user_id}::uuid`;
        }
        return json({ok:false,error:"Utente o PIN non validi"},401);
      }
    }else{
      throw new Error("CREDENTIAL_REQUIRED");
    }

    const {authUserId,internalEmail}=await ensureIdentity(legacy,pin);
    await sql`update public.auth_pin_credentials set failed_attempts=0,locked_until=null where auth_user_id=${authUserId}::uuid`;

    const membershipRows=await sql`select role,active,can_access_admin from public.hotel_memberships where auth_user_id=${authUserId}::uuid and hotel_id=${hotelId} limit 1`;
    const membership:any=membershipRows[0]||null;
    if(!membership?.active)return json({ok:false,error:"Accesso alla struttura non consentito"},403);

    const password=crypto.randomUUID()+crypto.randomUUID();
    await authJson(`/admin/users/${authUserId}`,"PUT",{password});
    const signed=await authJson("/token?grant_type=password","POST",{email:internalEmail,password},PUBLIC);
    if(!signed?.access_token||!signed?.refresh_token)throw new Error("Sessione non disponibile");

    const since=legacy.in_struttura_dal?new Date(legacy.in_struttura_dal).getTime():null;
    const presenceExpired=since!==null&&Date.now()-since>PRESENCE_MAX_MS;
    const role=canonicalRole(membership.role);
    const expiresAt=signed.expires_at || (signed.expires_in?Math.floor(Date.now()/1000)+Number(signed.expires_in):null);

    return json({ok:true,session:{access_token:signed.access_token,refresh_token:signed.refresh_token,expires_at:expiresAt},user:{id:authUserId,legacy_id:String(legacy.id),auth_user_id:authUserId,name:legacy.nome,role,can_admin:Boolean(membership.can_access_admin)||role==="admin",hotel_id:hotelId,department:legacy.department||null,email:legacy.email||null,phone:legacy.telefono||null,phone_country_code:legacy.phone_country_code||"+39",hotels:hotelList(legacy.hotels).length?hotelList(legacy.hotels):[hotelId],protected:Boolean(legacy.is_system_protected),active:true,in_struttura:Boolean(legacy.in_struttura)&&!presenceExpired,in_struttura_dal:legacy.in_struttura_dal||null}});
  }catch(error){
    const m=error instanceof Error?error.message:String(error||"unknown");
    if(m==="INACTIVE")return json({ok:false,error:"Utente disattivato"},403);
    if(m==="PROTECTED")return json({ok:false,error:"Account Admin accessibile solo dal pannello Admin"},403);
    if(m==="CREDENTIAL_REQUIRED")return json({ok:false,error:"Credenziale PIN non configurata. Contatta un amministratore."},403);
    console.error("pin-auth",m);
    return json({ok:false,error:"Errore temporaneo di accesso"},500);
  }
});