import { useEffect, useMemo, useState } from 'react'
import { Housekeeping as HousekeepingV2 } from './housekeeping-v2.jsx'
import { hotelGioClient } from './hotelgio-data.js'
import './housekeeping-history.css'

const stateLabels = {
  b2b:'Partenza + arrivo',
  partenza:'Partenza',
  arrivo:'Arrivo',
  fermata:'Fermata',
  libera:'Libera',
}

const formatDate = (value) => {
  if (!value) return ''
  const date = new Date(`${value}T12:00:00`)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('it-IT',{day:'2-digit',month:'2-digit',year:'numeric'})
}

function HousekeepingHistory({ hotel }) {
  const [imports,setImports] = useState([])
  const [selectedDate,setSelectedDate] = useState('')
  const [rooms,setRooms] = useState([])
  const [loading,setLoading] = useState(false)
  const [error,setError] = useState('')

  useEffect(() => {
    let active=true
    const loadImports=async()=>{
      setError('')
      const {data,error:queryError}=await hotelGioClient
        .from('import_camere')
        .select('id,hotel_id,work_date,caricato_il,caricato_da,n_camere,n_b2b,n_created,n_updated,n_unchanged,status')
        .eq('hotel_id',hotel.id)
        .order('work_date',{ascending:false})
        .order('caricato_il',{ascending:false})
        .limit(90)
      if(!active)return
      if(queryError){setError('Storico Housekeeping non disponibile');setImports([]);return}
      const rows=data||[]
      setImports(rows)
      setSelectedDate((current)=>current&&rows.some((item)=>item.work_date===current)?current:(rows[0]?.work_date||''))
    }
    loadImports()
    return()=>{active=false}
  },[hotel.id])

  useEffect(()=>{
    let active=true
    if(!selectedDate){setRooms([]);return()=>{active=false}}
    const loadRooms=async()=>{
      setLoading(true);setError('')
      const {data,error:queryError}=await hotelGioClient
        .from('housekeeping_daily_rooms')
        .select('hotel_id,work_date,camera,struttura,piano,tipologia,stato_slope,letti,arrivo,partenza,import_id,aggiornato_il')
        .eq('hotel_id',hotel.id)
        .eq('work_date',selectedDate)
        .order('struttura')
        .order('piano')
        .order('camera')
      if(!active)return
      setLoading(false)
      if(queryError){setError('Impossibile leggere lo storico del giorno');setRooms([]);return}
      setRooms(data||[])
    }
    loadRooms()
    return()=>{active=false}
  },[hotel.id,selectedDate])

  const dates=useMemo(()=>[...new Set(imports.map((item)=>item.work_date).filter(Boolean))],[imports])
  const latestImport=useMemo(()=>imports.find((item)=>item.work_date===selectedDate)||null,[imports,selectedDate])
  const groups=useMemo(()=>{
    const map=new Map()
    for(const room of rooms){
      const key=`${room.struttura||'Generale'}|${room.piano??0}`
      if(!map.has(key))map.set(key,{key,struttura:room.struttura||'Generale',piano:room.piano??0,rooms:[]})
      map.get(key).rooms.push(room)
    }
    return [...map.values()]
  },[rooms])

  if(!imports.length&&!error)return null

  return <section className="hk-history" aria-label="Storico Housekeeping">
    <div className="hk-history__head">
      <div>
        <h2>Storico giornaliero</h2>
        <p>Snapshot separati per struttura, sezione e piano. La consultazione è sola lettura.</p>
      </div>
      {!!dates.length&&<label>Giorno
        <select value={selectedDate} onChange={(event)=>setSelectedDate(event.target.value)}>
          {dates.map((date)=><option key={date} value={date}>{formatDate(date)}</option>)}
        </select>
      </label>}
    </div>

    {error&&<p className="hk-history__error" role="status">{error}</p>}

    {latestImport&&<div className="hk-history__summary">
      <span><b>{latestImport.n_camere||0}</b> camere</span>
      <span><b>{latestImport.n_b2b||0}</b> B2B</span>
      <span><b>{latestImport.n_created||0}</b> nuove</span>
      <span><b>{latestImport.n_updated||0}</b> aggiornate</span>
      <span><b>{latestImport.n_unchanged||0}</b> invariate</span>
    </div>}

    {loading?<div className="hk-history__empty">Carico storico…</div>:!rooms.length?<div className="hk-history__empty">Nessuno snapshot disponibile per questo giorno.</div>:<div className="hk-history__groups">
      {groups.map((group)=><article className="hk-history__group" key={group.key}>
        <header><strong>{group.struttura}</strong><span>Piano {group.piano}</span><small>{group.rooms.length} camere</small></header>
        <div className="hk-history__rooms">
          {group.rooms.map((room)=><div className={`hk-history__room hk-history__room--${room.stato_slope}`} key={room.camera}>
            <b>{room.camera}</b>
            <span>{room.tipologia||'Camera'}</span>
            <small>{stateLabels[room.stato_slope]||room.stato_slope}</small>
          </div>)}
        </div>
      </article>)}
    </div>}
  </section>
}

export function Housekeeping(props) {
  return <>
    <HousekeepingV2 {...props}/>
    <HousekeepingHistory hotel={props.hotel}/>
  </>
}
