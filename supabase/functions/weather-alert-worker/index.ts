import { createClient } from "npm:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(url, service, { auth: { persistSession:false, autoRefreshToken:false } });
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
const PRESENCE_MAX_MS=(7*60+20)*60*1000;
const HOTELS:Record<string,{name:string,latitude:number,longitude:number}>={
  hotelgio:{name:"Hotel Giò",latitude:43.112685,longitude:12.37818},
  chocohotel:{name:"Chocohotel",latitude:43.09932,longitude:12.38469},
  brigantino:{name:"Hotel Il Brigantino",latitude:43.46171,longitude:13.62708},
};
const max=(values:number[])=>values.reduce((best,value)=>Math.max(best,Number(value)||0),0);
const sleep=(ms:number)=>new Promise((resolve)=>setTimeout(resolve,ms));

async function secret(key:string){const{data}=await admin.from("edge_function_secrets").select("value").eq("key",key).maybeSingle();return data?.value||null}
async function hasPresentMaintainer(hotelId:string){
  const since=new Date(Date.now()-PRESENCE_MAX_MS).toISOString();
  const{data,error}=await admin.from("utenti").select("id").eq("active",true).eq("ruolo","manutentore").eq("in_struttura",true).gte("in_struttura_dal",since).contains("hotels",[hotelId]).limit(1);
  if(error){console.error("weather presence",hotelId,error.message);return false}
  return Boolean(data?.length)
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
async function state(hotelId:string){const{data}=await admin.from("weather_alert_state").select("*").eq("hotel_id",hotelId).maybeSingle();return data}
async function saveState(hotelId:string,result:any,notified:boolean){const{error}=await admin.from("weather_alert_state").upsert({hotel_id:hotelId,level:result.level,signature:`${result.level}:${result.actions.join("|")}`,last_payload:result,last_checked_at:new Date().toISOString(),...(notified?{last_notified_at:new Date().toISOString()}: {})},{onConflict:"hotel_id"});if(error)throw new Error(`weather_state_${error.message}`)}
async function sendNtfy(hotelId:string,hotelName:string,result:any){
  const{data:setting}=await admin.from("integration_settings").select("enabled,config").eq("key","ntfy_alerts").maybeSingle();
  const server=String(setting?.config?.server||"https://ntfy.sh").replace(/\/$/,""); const topic=String(setting?.config?.topics?.[hotelId]||"");
  if(!setting?.enabled||!topic) return false;
  const priority=result.level==="danger"?5:4; const tags=result.level==="danger"?["rotating_light","wind_face"]:["warning","umbrella"];
  const message=`${result.message} · Raffiche ${result.gust} km/h · Pioggia ${result.rainProbability}%`;
  const res=await fetch(server,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({topic,title:`METEO OPERATIVO · ${hotelName}`,message,priority,tags,click:"https://apicehotel.vercel.app/?notification=weather&hotel_id="+encodeURIComponent(hotelId)})});
  if(!res.ok) throw new Error(`ntfy_${res.status}`); return true;
}

Deno.serve(async(req:Request)=>{
  if(req.method!=="POST") return json({ok:false,error:"method_not_allowed"},405);
  const expected=await secret("weather_alert_cron_secret");
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
