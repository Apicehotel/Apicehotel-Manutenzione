import { lazy, Suspense, useState } from 'react'
import { HOTELS } from '../../config.js'
import EcosystemConsole from './EcosystemConsole.jsx'
import RandAIConfigurationConsole from './RandAIConfigurationConsole.jsx'
import './ecosystem-control.css'

const RandAIControlCenter=lazy(()=>import('./RandAIControlCenter.jsx'))
const LABEL=Object.fromEntries(HOTELS.map((hotel)=>[hotel.id,hotel.name]))

export default function RandAIControlHub({accessHotels=[]}){
  const [view,setView]=useState('control')
  const [hotel,setHotel]=useState(accessHotels.length===1?accessHotels[0]:'all')
  return <div className="rch-shell">
    <div className="rch-bar" role="navigation" aria-label="Rand Control 360"><div className="rch-tabs"><button className={view==='control'?'active':''} onClick={()=>setView('control')}>Control Center</button><button className={view==='ecosystem'?'active':''} onClick={()=>setView('ecosystem')}>Ecosistema</button><button className={view==='configuration'?'active':''} onClick={()=>setView('configuration')}>Configurazione 360°</button></div>{view==='configuration'&&<select value={hotel} onChange={(e)=>setHotel(e.target.value)} aria-label="Hotel configurazione">{accessHotels.length>1&&<option value="all">Tutte le strutture</option>}{accessHotels.map((id)=><option key={id} value={id}>{LABEL[id]||id}</option>)}</select>}</div>
    {view==='control'?<Suspense fallback={<div className="ra-gate"><div className="ra-loading">Caricamento Control Center…</div></div>}><RandAIControlCenter/></Suspense>:view==='ecosystem'?<main className="rch-page"><header><small>RAND CONTROL 360</small><h1>Ecosistema Rand</h1><p>Stato reale dei moduli e delle capability.</p></header><EcosystemConsole/></main>:<main className="rch-page"><header><small>RAND CONTROL 360</small><h1>Configurazione RandAI</h1><p>Policy e comportamento non-secret, versionati e hotel-scoped.</p></header><RandAIConfigurationConsole accessHotels={accessHotels} hotelFilter={hotel}/></main>}
  </div>
}
