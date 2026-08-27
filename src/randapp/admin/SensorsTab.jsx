import { useEffect, useState } from 'react'
import { HOTELS } from '../../config.js'
import { supabaseUrl } from '../../supabase.js'
import { fetchAllSensors, updateSensorVisibility, syncSensorsFromEwelink } from '../../sensors-admin-data.js'
import { Button, Card, EmptyState, Spinner } from '../ui.jsx'

export default function SensorsTab(){
  const[sensors,setSensors]=useState([]),[loading,setLoading]=useState(true),[syncing,setSyncing]=useState(false)
  useEffect(()=>{fetchAllSensors().then(r=>setSensors(r.sensors||[])).catch(()=>{}).finally(()=>setLoading(false))},[])
  const toggle=async(s,id)=>{const f={hotelgio:!!s.mostra_hotelgio,chocohotel:!!s.mostra_chocohotel,brigantino:!!s.mostra_brigantino};f[id]=!f[id];setSensors(l=>l.map(x=>x.device_id===s.device_id?{...x,[`mostra_${id}`]:f[id]}:x));await updateSensorVisibility(s.device_id,f)}
  const sync=async()=>{setSyncing(true);try{const r=await syncSensorsFromEwelink(supabaseUrl);setSensors(r.sensors||[])}finally{setSyncing(false)}}
  if(loading)return <Spinner label="Carico i sensori…"/>
  return <section data-testid="settings-sensors"><div className="rs-page-title"><div><h1>Sensori</h1><p>Visibilità dei sensori eWeLink per struttura</p></div><Button variant="ghost" icon="refresh" onClick={sync} disabled={syncing}>{syncing?'Sincronizzo…':'Sincronizza'}</Button></div>{sensors.length===0?<EmptyState icon="sensor" title="Nessun sensore">Sincronizza da eWeLink per popolare la lista.</EmptyState>:sensors.map(s=><Card key={s.device_id} className="rs-sensor"><div className="rs-sensor__info"><strong>{s.nome||s.device_id}</strong><small>{s.temperatura!=null?`${s.temperatura}°C`:'Temperatura non disponibile'}</small></div><div className="rs-hotel-toggles">{HOTELS.map(h=><button key={h.id} className={`rs-hotel-toggle ${s[`mostra_${h.id}`]?'on':''}`} onClick={()=>toggle(s,h.id)}>{s[`mostra_${h.id}`]?'✓ ':''}{h.short}</button>)}</div></Card>)}</section>
}
