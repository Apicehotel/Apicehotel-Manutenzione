import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Dexie from 'dexie'
import { HOTEL_LOCATIONS } from './locations.js'
import { hotelGioClient } from './hotelgio-data.js'

const cache = new Dexie('apiceHousekeeping')
cache.version(1).stores({ giorno: 'camera', lavoro: 'camera', outbox: 'camera' })
const STRUCTURES = ['Wine', 'Jazz'], FLOORS = [1, 2, 3, 4]
const workLabels = { dafare:'Da fare', corso:'In corso', fatto:'Fatta', nondist:'Non disturbare' }
const slopeLabels = { b2b:'Partenza + arrivo', partenza:'Partenza', arrivo:'Arrivo', fermata:'Fermata', libera:'Libera' }
const roomMeta = Object.fromEntries(HOTEL_LOCATIONS.hotelgio.roomGroups.flatMap((group) => {
  const structure = group.name.startsWith('Jazz') ? 'Jazz' : 'Wine'
  const floor = Number(group.name.match(/P(\d)/)?.[1] || 1)
  return group.rooms.map((room) => [room, { structure, floor }])
}))

const dateOnly = (value) => {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? String(value).slice(0,5) : date.toLocaleDateString('it-IT',{day:'2-digit',month:'2-digit'})
}
const classify = (text) => {
  const value = String(text || '').toLowerCase()
  if (value.includes('partenza') && value.includes('arrivo')) return 'b2b'
  if (value.includes('partenza')) return 'partenza'
  if (value.includes('arrivo')) return 'arrivo'
  if (value.includes('soggiorno') || value.includes('fermata')) return 'fermata'
  return 'libera'
}
const parseSlope = async (file) => {
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(await file.arrayBuffer(), { type:'array', cellDates:true })
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header:1, raw:true, defval:'' })
  const found = new Map()
  rows.forEach((row) => {
    const camera = String(row[2] || '').trim()
    if (!roomMeta[camera]) return
    const base = roomMeta[camera]
    const current = found.get(camera) || { camera, struttura:base.structure, piano:base.floor, tipologia:String(row[1]||''), letti:'', note:'', arrivo:'', partenza:'', states:[] }
    current.states.push(classify(row[3])); current.arrivo ||= dateOnly(row[4]); current.partenza ||= dateOnly(row[5]); current.letti ||= String(row[7]||row[6]||''); current.note ||= String(row[8]||'')
    found.set(camera,current)
  })
  return Object.entries(roomMeta).map(([camera,base]) => {
    const item = found.get(camera) || { camera, struttura:base.structure, piano:base.floor, tipologia:'', letti:'', note:'', arrivo:'', partenza:'', states:[] }
    const stato_slope = item.states.includes('partenza') && item.states.includes('arrivo') ? 'b2b' : item.states.find((state)=>state!=='libera') || 'libera'
    const { states, ...rest } = item
    return { ...rest, stato_slope }
  })
}

export function Housekeeping({ user }) {
  const [day,setDay]=useState([]), [work,setWork]=useState([]), [loading,setLoading]=useState(true), [structure,setStructure]=useState('Wine'), [floor,setFloor]=useState(1), [order,setOrder]=useState('urgenti'), [open,setOpen]=useState(null), [uploading,setUploading]=useState(false), [pending,setPending]=useState(0), [message,setMessage]=useState('')
  const fileRef=useRef(null)
  const canUpload = user.department === 'Reception' || user.role === 'Portiere Notturno'
  const canEdit = user.department === 'Reception' || user.department === 'Governante'
  const refresh = useCallback(async () => {
    if (navigator.onLine) {
      const [{data:g},{data:w}] = await Promise.all([hotelGioClient.from('camere_giorno').select('*'),hotelGioClient.from('camere_lavoro').select('*')])
      if (g?.length) await cache.giorno.bulkPut(g)
      if (w?.length) await cache.lavoro.bulkPut(w)
    }
    const [g,w,p]=await Promise.all([cache.giorno.toArray(),cache.lavoro.toArray(),cache.outbox.count()]); setDay(g);setWork(w);setPending(p);setLoading(false)
  },[])
  const drain = useCallback(async () => {
    if (!navigator.onLine) return
    for (const item of await cache.outbox.toArray()) {
      const { error } = item.kind==='work' ? await hotelGioClient.from('camere_lavoro').upsert(item.payload) : await hotelGioClient.from('camere_giorno').update(item.payload).eq('camera',item.camera)
      if (!error) await cache.outbox.delete(item.camera)
    }
    refresh()
  },[refresh])
  useEffect(()=>{ refresh();drain(); const channel=hotelGioClient.channel('apice-housekeeping').on('postgres_changes',{event:'*',schema:'public',table:'camere_giorno'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'camere_lavoro'},refresh).subscribe(); window.addEventListener('online',drain); return()=>{hotelGioClient.removeChannel(channel);window.removeEventListener('online',drain)} },[refresh,drain])
  const workByRoom=useMemo(()=>Object.fromEntries(work.map((item)=>[item.camera,item])),[work])
  const rooms=useMemo(()=>{
    const values=day.filter((item)=>item.struttura===structure&&Number(item.piano)===floor).map((item)=>({...item,lavoro:workByRoom[item.camera]?.stato||(item.stato_slope==='libera'?'fatto':'dafare')}))
    const weight={b2b:0,partenza:1,arrivo:2,fermata:3,libera:5}
    return values.sort((a,b)=>order==='numero'?a.camera.localeCompare(b.camera,'it',{numeric:true}):(weight[a.stato_slope]-weight[b.stato_slope]||a.camera.localeCompare(b.camera,'it',{numeric:true})))
  },[day,workByRoom,structure,floor,order])
  const setWorkState=async(camera,state)=>{const payload={camera,stato:state,da_chi:user.name,aggiornato_il:new Date().toISOString()};await cache.lavoro.put(payload);await cache.outbox.put({camera,kind:'work',payload});setMessage(`Camera ${camera}: ${workLabels[state]}`);await refresh();drain()}
  const saveDetails=async(camera,fields)=>{const payload={...fields,manuale:true,manuale_da:user.name,manuale_il:new Date().toISOString(),aggiornato_il:new Date().toISOString()};await cache.giorno.update(camera,payload);await cache.outbox.put({camera,kind:'day',payload});setOpen(null);await refresh();drain()}
  const upload=async(event)=>{const file=event.target.files?.[0];event.target.value='';if(!file)return;setUploading(true);try{const rooms=await parseSlope(file);const {error}=await hotelGioClient.rpc('carica_camere_giorno',{p_caricato_da:user.name,p_camere:rooms});setMessage(error?`Errore caricamento: ${error.message}`:`Caricate ${rooms.length} camere dal file Slope`);await refresh()}catch{setMessage('File non leggibile: usa l’export Housekeeping di Slope')}setUploading(false)}
  return <section className="housekeeping-page">
    <header><div><h1>Housekeeping</h1><p><span className={pending?'pending':'synced'}/>{pending?`${pending} modifiche in attesa di rete`:'Sincronizzato'}</p></div>{canUpload&&<><input ref={fileRef} type="file" accept=".xls,.xlsx" hidden onChange={upload}/><button className="primary" disabled={uploading} onClick={()=>fileRef.current?.click()}>{uploading?'Caricamento…':'Carica file Slope'}</button></>}</header>
    {message&&<p className="housekeeping-message" role="status">{message}</p>}
    <div className="hk-structures" aria-label="Struttura">{STRUCTURES.map((item)=><button className={structure===item?'active':''} aria-pressed={structure===item} onClick={()=>setStructure(item)} key={item}>{item}</button>)}</div>
    <div className="hk-floors" aria-label="Piano">{FLOORS.map((item)=>{const count=day.filter((room)=>room.struttura===structure&&Number(room.piano)===item&&room.stato_slope!=='libera'&&!['fatto','nondist'].includes(workByRoom[room.camera]?.stato)).length;return <button className={floor===item?'active':''} aria-pressed={floor===item} onClick={()=>setFloor(item)} key={item}><strong>{item}° piano</strong><small>{count} da fare</small></button>})}</div>
    <div className="hk-toolbar"><strong>{structure} · {floor}° piano</strong><select aria-label="Ordina camere" value={order} onChange={(e)=>setOrder(e.target.value)}><option value="urgenti">Urgenti prima</option><option value="numero">Per numero</option></select></div>
    {loading?<div className="temperature-empty">Carico Housekeeping…</div>:!rooms.length?<div className="temperature-empty">Carica il file Slope di oggi per iniziare.</div>:<div className="hk-grid">{rooms.map((room)=><button type="button" className={`hk-room ${room.stato_slope} ${room.lavoro}`} key={room.camera} onClick={()=>setOpen(room)} aria-label={`Camera ${room.camera}, ${slopeLabels[room.stato_slope]}, ${workLabels[room.lavoro]}${room.note?', con nota':''}`}><div><strong>{room.camera}</strong><span>{room.tipologia||'Camera'}</span></div><b>{slopeLabels[room.stato_slope]}</b><small>{workLabels[room.lavoro]}</small>{room.note&&<em>Nota</em>}</button>)}</div>}
    {open&&<RoomSheet room={open} canEdit={canEdit} onClose={()=>setOpen(null)} onState={(state)=>{setWorkState(open.camera,state);setOpen(null)}} onSave={(fields)=>saveDetails(open.camera,fields)}/>}  
  </section>
}

function RoomSheet({room,canEdit,onClose,onState,onSave}){
  const [fields,setFields]=useState({stato_slope:room.stato_slope,letti:room.letti||'',note:room.note||''})
  return <div className="hk-backdrop" onClick={onClose}><section className="hk-sheet" role="dialog" aria-modal="true" aria-labelledby="hk-room-title" onClick={(e)=>e.stopPropagation()}><header><div><small>Camera</small><h2 id="hk-room-title">{room.camera}</h2></div><button onClick={onClose} aria-label="Chiudi dettaglio camera">✕</button></header><div className="hk-details"><p><strong>{slopeLabels[room.stato_slope]}</strong>{room.arrivo&&` · arrivo ${room.arrivo}`}{room.partenza&&` · partenza ${room.partenza}`}</p><p>{room.tipologia||'Tipologia non indicata'}{room.letti&&` · ${room.letti}`}</p>{room.note&&<p>Note: {room.note}</p>}</div>{canEdit&&<><div className="hk-actions" aria-label="Stato pulizia">{Object.entries(workLabels).map(([key,label])=><button className={room.lavoro===key?'active':''} aria-pressed={room.lavoro===key} key={key} onClick={()=>onState(key)}>{label}</button>)}</div><form onSubmit={(e)=>{e.preventDefault();onSave(fields)}}><label>Stato soggiorno<select value={fields.stato_slope} onChange={(e)=>setFields({...fields,stato_slope:e.target.value})}>{Object.entries(slopeLabels).map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></label><label>Configurazione letti<input value={fields.letti} onChange={(e)=>setFields({...fields,letti:e.target.value})}/></label><label>Note<textarea rows="3" value={fields.note} onChange={(e)=>setFields({...fields,note:e.target.value})}/></label><button className="primary">Salva modifica</button></form></>}</section></div>
}
