import { createClient } from "npm:@supabase/supabase-js@2";
import bcrypt from "npm:bcryptjs@2.4.3";

const URL=Deno.env.get("SUPABASE_URL")!, ANON=Deno.env.get("SUPABASE_ANON_KEY")!, SERVICE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin=createClient(URL,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"GET, POST, OPTIONS"};
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
const ROLE_VALUES=new Set(["admin","Supremo","Direzione","Direttore Centro Congressi","Portiere Notturno","Responsabile","manutentore","Tecnico esterno","Governante","Capo Governante","Reception","Isola dei Golosi","Ristorante Wine/Jazz","Colazione Jazz"]);
const canonicalRole=(v:unknown)=>{const r=String(v||"Reception").trim();return ROLE_VALUES.has(r)?r:"Reception"};
const PRESENCE_MAX_MS=(7*60+20)*60*1000;

async function listDirectory(hotelId:string){
  const {data,error}=await admin.from("utenti").select("id,nome,ruolo,hotels,active,is_system_protected").eq("active",true).neq("ruolo","RandAI").or('is_system_protected.eq.false,nome.eq.Randagio').contains("hotels",[hotelId]).order("nome");
  if(error)throw error;
  return(data||[]).map((u:any)=>({
    id:u.id,
    legacy_id:u.id,
    name:u.nome,
    role:canonicalRole(u.ruolo),
    hotels:Array.isArray(u.hotels)?u.hotels:[hotelId],
    hotel_id:hotelId,
  }));
}

async function resolveLegacyUserId(userId:string){
  const {data,error}=await admin.from("profiles").select("legacy_user_id").eq("auth_user_id",userId).maybeSingle();
  if(error)throw error;
  return data?.legacy_user_id?String(data.legacy_user_id):userId;
}

async function identityForLegacy(legacy:any){
  const {data:existing,error}=await admin.from("profiles").select("auth_user_id,active,is_system_protected").eq("legacy_user_id",legacy.id).maybeSingle();
  if(error)throw error;
  if(!existing?.auth_user_id)throw new Error("NO_IDENTITY");
  if(existing.is_system_protected&&legacy.nome!=="Randagio")throw new Error("PROTECTED");
  if(existing.active===false)throw new Error("INACTIVE");
  return existing.auth_user_id as string;
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  try{
    if(req.method==="GET"){
      const hotelId=new URL(req.url).searchParams.get("hotel_id")?.trim();
      if(!hotelId)return json({ok:false,error:"hotel_id mancante"},400);
      return json({ok:true,users:await listDirectory(hotelId)});
    }
    if(req.method!=="POST")return json({ok:false,error:"Metodo non consentito"},405);
    const body=await req.json().catch(()=>null),action=String(body?.action||"login"),hotelId=String(body?.hotel_id||"").trim();
    if(action==="directory"){
      if(!hotelId)return json({ok:false,error:"hotel_id mancante"},400);
      return json({ok:true,users:await listDirectory(hotelId)});
    }
    const userId=String(body?.user_id||"").trim(),pin=String(body?.pin||"").trim();
    if(!hotelId||!userId||!/^\d{4}$/.test(pin))return json({ok:false,error:"Dati login non validi"},400);
    const legacyUserId=await resolveLegacyUserId(userId);
    const {data:legacy,error:legacyError}=await admin.from("utenti").select("id,nome,ruolo,hotels,department,telefono,email,phone_country_code,active,is_system_protected,in_struttura,in_struttura_dal").eq("id",legacyUserId).eq("active",true).neq("ruolo","RandAI").or('is_system_protected.eq.false,nome.eq.Randagio').contains("hotels",[hotelId]).maybeSingle();
    if(legacyError||!legacy)return json({ok:false,error:"Utente o PIN non validi"},401);

    const authUserId=await identityForLegacy(legacy);
    const {data:credential,error:credentialError}=await admin.from("auth_pin_credentials").select("pin_hash,failed_attempts,locked_until").eq("auth_user_id",authUserId).maybeSingle();
    if(credentialError)throw credentialError;
    if(!credential?.pin_hash)return json({ok:false,error:"Accesso PIN non configurato"},403);
    if(credential.locked_until&&new Date(credential.locked_until).getTime()>Date.now())return json({ok:false,error:"Troppi tentativi. Riprova più tardi."},429);
    const valid=await bcrypt.compare(pin,credential.pin_hash);
    if(!valid){
      const failures=Number(credential.failed_attempts||0)+1,patch:Record<string,unknown>={failed_attempts:failures,updated_at:new Date().toISOString()};
      if(failures>=5){patch.failed_attempts=0;patch.locked_until=new Date(Date.now()+10*60*1000).toISOString()}
      await admin.from("auth_pin_credentials").update(patch).eq("auth_user_id",authUserId);
      return json({ok:false,error:"Utente o PIN non validi"},401);
    }
    await admin.from("auth_pin_credentials").update({failed_attempts:0,locked_until:null,updated_at:new Date().toISOString()}).eq("auth_user_id",authUserId);

    const {data:membership,error:membershipError}=await admin.from("hotel_memberships").select("role,active,can_access_admin").eq("auth_user_id",authUserId).eq("hotel_id",hotelId).maybeSingle();
    if(membershipError)throw membershipError;
    if(!membership?.active)return json({ok:false,error:"Accesso alla struttura non consentito"},403);

    const internalEmail=legacy.is_system_protected&&legacy.nome==="Randagio"?`system-randagio-${legacy.id}@auth.apicehotel.invalid`:`u-${legacy.id}@auth.apicehotel.invalid`;
    const password=crypto.randomUUID()+crypto.randomUUID();
    const {error:passwordError}=await admin.auth.admin.updateUserById(authUserId,{password});
    if(passwordError)throw passwordError;
    const client=createClient(URL,ANON,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:signed,error:signError}=await client.auth.signInWithPassword({email:internalEmail,password});
    if(signError||!signed.session)throw signError||new Error("Sessione non disponibile");
    const since=legacy.in_struttura_dal?new Date(legacy.in_struttura_dal).getTime():null,presenceExpired=since!==null&&Date.now()-since>PRESENCE_MAX_MS,role=canonicalRole(membership.role);
    return json({ok:true,session:{access_token:signed.session.access_token,refresh_token:signed.session.refresh_token,expires_at:signed.session.expires_at},user:{id:authUserId,legacy_id:legacy.id,auth_user_id:authUserId,name:legacy.nome,role,can_admin:Boolean(membership.can_access_admin)||role==="admin",hotel_id:hotelId,department:legacy.department||null,email:legacy.email||null,phone:legacy.telefono||null,phone_country_code:legacy.phone_country_code||"+39",hotels:legacy.hotels||[hotelId],protected:Boolean(legacy.is_system_protected),active:true,in_struttura:Boolean(legacy.in_struttura)&&!presenceExpired,in_struttura_dal:legacy.in_struttura_dal||null}});
  }catch(error){
    const m=error instanceof Error?error.message:"unknown";
    if(m==="INACTIVE")return json({ok:false,error:"Utente disattivato"},403);
    if(m==="PROTECTED")return json({ok:false,error:"Account Admin accessibile solo dal pannello Admin"},403);
    if(m==="NO_IDENTITY")return json({ok:false,error:"Accesso PIN non configurato"},403);
    console.error("pin-auth",m);
    return json({ok:false,error:"Errore temporaneo di accesso"},500);
  }
});