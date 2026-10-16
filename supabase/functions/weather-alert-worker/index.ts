import postgres from "npm:postgres@3.4.7";

// Postgres diretto: dal 1 ottobre 2026 PostgREST risponde 401 alle chiamate REST
// delle Edge Function con la chiave service_role.
const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 2, connect_timeout: 5, idle_timeout: 10 });
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
const PRESENCE_MAX_MS=(7*60+20)*60*1000;
const HOTELS:Record<string,{name:string,latitude:number,longitude:number}>={
  hotelgio:{name:"Hotel Giò",latitude:43.112685,longitude:12.37818},
  chocohotel:{name:"Chocohotel",latitude:43.09932,longitude:12.38469},
  brigantino:{name:"Hotel Il Brigantino",latitude:43.46171,longitude:13.62708},
};
const max=(values:number[])=>values.reduce((best,value)=>Math.max(best,Number(value)||0),0);
const sleep=(ms:number)=>new Promise((resolve)=>setTimeout(resolve,ms));

async function secret(key:string){const rows=await sql`select value from public.edge_function_secrets where key = ${key} limit 1`;return rows[0]?.value?String(rows[0].value):null}
async function hasPresentMaintainer(hotelId:string){
  const since=new Date(Date.now()-PRESENCE_MAX_MS).toISOString();
  try{
    const rows=await sql`select id from public.utenti where active = true and ruolo = 'manutentore' and in_struttura = true
      and in_struttura_dal >= ${since}::timestamptz and hotels @> ${[hotelId]}::text[] limit 1`;
    return rows.length>0
  }catch(error){console.error("weather presence",hotelId,error instanceof Error?error.message:"unknown");return false}
}
async function weather(hotel:{latitude:number,longitude:number}){
  const qs=new URLSearchParams({latitude:String(hotel.latitude),longitude:String(hotel.longitude),hourly:"precipitation_probability,precipitation,wind_speed_10m,wind_gusts_10m",forecast_days:"2",timezone:"Europe/Rome",wind_speed_unit:"kmh"});
  const endpoint=`https://api.open-meteo.com/v1/forecast?${qs}`;
  let lastError="open_meteo_unknown";
  for(let attempt=1;attempt<=3;attempt++){
    try{
      const controller=new AbortController(); const timeout=setTimeout(()=>controller.abort(),6500);
      const res=await fetch(endpoint,{signal:controller.signal}); clearTimeout(timeout);
      if(res.ok)return await res.json();
      lastError=`open_meteo_${res.status}`;
      if(res.status<500&&res.status!==429)break;
    }catch(error){lastError=error instanceof Error?error.message:"open_meteo_fetch_failed"}
    if(attempt<3)await sleep(250*attempt);
  }
  throw new Error(lastError);
}
function evaluate(payload:any){
  const h=payload?.hourly||{}; const now=Date.now();
  const idx=(h.time||[]).map((time:string,index:number)=>({index,time:new Date(time).getTime()})).filter((x:any)=>x.time>=now-30*60*1000&&x.time<=now+2*60*60*1000).map((x:any)=>x.index);
  const pick=(key:string)=>idx.map((i:number)=>Number(h[key]?.[i])||0);
  const gust=max(pick("wind_gusts_10m")); const wind=max(pick("wind_speed_10m")); const rainProbability=max(pick("precipitation_probability")); const rainAmount=max(pick("precipitation"));
  let level="ok"; const actions:string[]=[];
  if(gust>=55){level="danger";actions.push("Chiudere subito gli ombrelloni")} else if(gust>=40){level="warning";actions.push("Controllare e chiudere gli ombrelloni")}
  if(rainProbability>=60||rainAmount>=0.4){if(level==="ok")level="warning";actions.push("Sospendere irrigazione")}
  return{level,gust:Math.round(gust),wind:Math.round(wind),rainProbability:Math.round(rainProbability),rainAmount:Math.round(rainAmount*10)/10,actions,message:actions.length?actions.join(" · "):"Nessuna azione richiesta"};
}
async function state(hotelId:string){const rows=await sql`select * from public.weather_alert_state where hotel_id = ${hotelId} limit 1`;return rows[0]??null}
async function saveState(hotelId:string,result:any,notified:boolean){
  try{
    await sql`insert into public.weather_alert_state (hotel_id, level, signature, last_payload, last_checked_at, last_notified_at)
      values (${hotelId}, ${result.level}, ${`${result.level}:${result.actions.join("|")}`}, ${sql.json(result)}, now(), ${notified?new Date().toISOString():null}::timestamptz)
      on conflict (hotel_id) do update set level = excluded.level, signature = excluded.signature,
        last_payload = excluded.last_payload, last_checked_at = excluded.last_checked_at,
        last_notified_at = case when ${notified}::boolean then excluded.last_notified_at else public.weather_alert_state.last_notified_at end`
  }catch(error){throw new Error(`weather_state_${error instanceof Error?error.message:"unknown"}`)}
}
async function sendNtfy(hotelId:string,hotelName:string,result:any){
  const settingRows=await sql`select enabled, config from public.integration_settings where key = 'ntfy_alerts' limit 1`;const setting=settingRows[0];
  const server=String(setting?.config?.server||"https://ntfy.sh").replace(/\/$/,""); const topic=String(setting?.config?.topics?.[hotelId]||"");
  if(!setting?.enabled||!topic) return false;
  const priority=result.level==="danger"?5:4; const tags=result.level==="danger"?["rotating_light","wind_face"]:["warning","umbrella"];
  const message=`${result.message} · Raffiche ${result.gust} km/h · Pioggia ${result.rainProbability}%`;
  const res=await fetch(server,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({topic,title:`METEO OPERATIVO · ${hotelName}`,message,priority,tags,click:"https://apicehotel.vercel.app/?notification=weather&hotel_id="+encodeURIComponent(hotelId)})});
  if(!res.ok) throw new Error(`ntfy_${res.status}`); return true;
}

Deno.serve(async(req:Request)=>{
  if(req.method!=="POST") return json({ok:false,error:"method_not_allowed"},405);
  let expected:string|null;
  try{expected=await secret("weather_alert_cron_secret")}catch(error){console.error("weather secret",error instanceof Error?error.message:"unknown");return json({ok:false,error:"temporary_error"},500)}
  if(!expected||req.headers.get("x-cron-secret")!==expected) return json({ok:false,error:"forbidden"},403);
  const summary:any[]=[];
  for(const [hotelId,hotel] of Object.entries(HOTELS)){
    try{
      const result=evaluate(await weather(hotel)); const previous=await state(hotelId); const present=await hasPresentMaintainer(hotelId); const signature=`${result.level}:${result.actions.join("|")}`;
      const escalated=previous?.level==="warning"&&result.level==="danger"; const changed=previous?.signature!==signature; const actionable=result.level!=="ok";
      let notified=false;
      if(actionable&&present&&(changed||escalated)){notified=await sendNtfy(hotelId,hotel.name,result)}
      await saveState(hotelId,result,notified);
      summary.push({hotel_id:hotelId,level:result.level,present_maintainer:present,notified});
    }catch(error){const reason=error instanceof Error?error.message:"unknown";console.error("weather worker",hotelId,reason);summary.push({hotel_id:hotelId,error:true,reason})}
  }
  const ok=summary.every((item)=>!item.error);
  return json({ok,summary});
});
