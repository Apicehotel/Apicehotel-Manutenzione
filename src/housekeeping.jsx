import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Dexie from 'dexie'
import { HOTEL_LOCATIONS } from './locations.js'
import { hotelGioClient } from './hotelgio-data.js'

const cache = new Dexie('apiceHousekeeping')
cache.version(2).stores({ giorno: 'camera', lavoro: 'camera', outbox: 'camera' })
const workLabels = { dafare:'Da fare', corso:'In corso', fatto:'Fatta', nondist:'Non disturbare' }
const slopeLabels = { b2b:'Partenza + arrivo', partenza:'Partenza', arrivo:'Arrivo', fermata:'Fermata', libera:'Libera' }

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
const groupsForHotel = (hotelId) => HOTEL_LOCATIONS[hotelId]?.roomGroups || []
const gioSections = ['Jazz','Wine']
const gioSectionFromGroup = (groupName) => gioSections.find((section)=>String(groupName||'').startsWith(section)) || 'Jazz'
const gioFloorFromGroup = (groupName) => Number(String(groupName||'').match(/P(\d+)/)?.[1] || 1)
const roomMetaForHotel = (hotelId) => Object.fromEntries(groupsForHotel(hotelId).flatMap((group) => group.rooms.map((room) => [room, { group: group.name }])))
const textValue = (value) => value == null ? '' : String(value).trim()
const reportHotelId = (label) => {
  const value = textValue(label).toLowerCase().replace(/[^a-z0-9à-ù]/g,'')
  if (value.includes('choco')) return 'chocohotel'
  if (value.includes('brigantino')) return 'brigantino'
  if (value.includes('gio') || value.includes('giò')) return 'hotelgio'
  return null
}
const formatReportCell = (value) => {
  if (value == null || value === '') return '—'
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toLocaleDateString('it-IT')
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toLocaleString('it-IT',{maximumFractionDigits:2})
  return String(value)
}
const parseRevenueReport = (rows) => {
  const flattened = rows.slice(0,14).flat().map(textValue).join(' ').toLowerCase()
  if (!flattened.includes('occupazione e revenue')) return null
  const structureName = textValue(rows[0]?.[0]) || 'Struttura'
  const hotelId = reportHotelId(structureName)
  const title = textValue(rows.find((row)=>textValue(row?.[0]).toLowerCase().includes('report:'))?.[0]) || 'Occupazione e revenue'
  const period = textValue(rows.find((row)=>textValue(row?.[0]).toLowerCase().startsWith('periodo:'))?.[0]).replace(/^Periodo:\s*/i,'')
  const headerIndex = rows.findIndex((row)=>textValue(row?.[0]).toLowerCase()==='data' && row.some((cell)=>textValue(cell).toLowerCase().includes('alloggi prenotati')))
  if (headerIndex < 0) throw new Error('Intestazioni del report non riconosciute')
  const top = rows[headerIndex] || []
  const sub = rows[headerIndex+1] || []
  const maxColumns = Math.max(top.length, sub.length, ...rows.slice(headerIndex+2).map((row)=>row.length))
  const headers = Array.from({length:maxColumns},(_,index)=>{
    if (index===0) return 'Data'
    const child = textValue(sub[index])
    const parent = textValue(top[index])
    if (child && parent && child.toLowerCase() !== parent.toLowerCase()) return child
    return child || parent || `Colonna ${index+1}`
  })
  const body = []
  let total = null
  for (const row of rows.slice(headerIndex+2)) {
    const first = textValue(row?.[0])
    if (!first) continue
    const normalized = Array.from({length:maxColumns},(_,index)=>row[index] ?? '')
    if (first.toLowerCase()==='totale') { total = normalized; break }
    const parsedDate = row[0] instanceof Date ? row[0] : new Date(row[0])
    if (Number.isNaN(parsedDate.getTime())) continue
    normalized[0] = parsedDate
    body.push(normalized)
  }
  if (!body.length) throw new Error('Il report non contiene righe giornaliere leggibili')
  const indexOf = (name) => headers.findIndex((header)=>header.toLowerCase()===name.toLowerCase())
  return { kind:'revenue', hotelId, structureName, title, period, headers, rows:body, total, indexes:{ booked:indexOf('Alloggi prenotati'), free:indexOf('Alloggi liberi'), occupancy:indexOf('Tasso di occupazione'), revenue:indexOf('Ricavo da prenotazioni'), adr:indexOf('ADR'), revpar:indexOf('RevPAR') } }
}
const parseSlopeRows = (rows, hotelId) => {
  const roomMeta = roomMetaForHotel(hotelId)
  const found = new Map()
  rows.forEach((row) => {
    const camera = String(row[2] || '').trim()
    if (!roomMeta[camera]) return
    const base = roomMeta[camera]
    const current = found.get(camera) || { camera, gruppo:base.group, tipologia:String(row[1]||''), letti:'', note:'', arrivo:'', partenza:'', states:[] }
    current.states.push(classify(row[3])); current.arrivo ||= dateOnly(row[4]); current.partenza ||= dateOnly(row[5]); current.letti ||= String(row[7]||row[6]||''); current.note ||= String(row[8]||'')
    found.set(camera,current)
  })
  return Object.entries(roomMeta).map(([camera,base]) => {
    const item = found.get(camera) || { camera, gruppo:base.group, tipologia:'', letti:'', note:'', arrivo:'', partenza:'', states:[] }
    const stato_slope = item.states.includes('partenza') && item.states.includes('arrivo') ? 'b2b' : item.states.find((state)=>state!=='libera') || 'libera'
    const { states, ...rest } = item
    return { ...rest, stato_slope }
  })
}
const parseWorkbook = async (file, hotelId) => {
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(await file.arrayBuffer(), { type:'array', cellDates:true })
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header:1, raw:true, defval:'' })
  const revenue = parseRevenueReport(rows)
  if (revenue) return revenue
  return { kind:'housekeeping', rooms:parseSlopeRows(rows,hotelId) }
}

export function Housekeeping({ user, hotel }) {
  const groups = useMemo(()=>groupsForHotel(hotel.id),[hotel.id])
  const [day,setDay]=useState([]), [work,setWork]=useState([]), [loading,setLoading]=useState(true), [group,setGroup]=useState(groups[0]?.name||''), [order,setOrder]=useState('urgenti'), [open,setOpen]=useState(null), [uploading,setUploading]=useState(false), [pending,setPending]=useState(0), [message,setMessage]=useState(''), [revenueReport,setRevenueReport]=useState(null)
  const fileRef=useRef(null)
  const canUpload = user.department === 'Reception' || user.role === 'Portiere Notturno'
  const canEdit = user.department === 'Reception' || user.department === 'Governante'
  useEffect(()=>{setGroup(groups[0]?.name||'');setRevenueReport(null)},[hotel.id])
  const refresh = useCallback(async () => {
    if (navigator.onLine) {
      const [{data:g},{data:w}] = await Promise.all([hotelGioClient.from('camere_giorno').select('*').eq('hotel_id',hotel.id),hotelGioClient.from('camere_lavoro').select('*').eq('hotel_id',hotel.id)])
      if (g) { await cache.giorno.clear(); if (g.length) await cache.giorno.bulkPut(g) }
      if (w) { await cache.lavoro.clear(); if (w.length) await cache.lavoro.bulkPut(w) }
    }
    const [g,w,p]=await Promise.all([cache.giorno.toArray(),cache.lavoro.toArray(),cache.outbox.count()]); setDay(g);setWork(w);setPending(p);setLoading(false)
  },[hotel.id])
  const drain = useCallback(async () => {
    if (!navigator.onLine) return
    for (const item of await cache.outbox.toArray()) {
      const { error } = item.kind==='work' ? await hotelGioClient.from('camere_lavoro').upsert(item.payload) : await hotelGioClient.from('camere_giorno').update(item.payload).eq('hotel_id',hotel.id).eq('camera',item.camera)
      if (!error) await cache.outbox.delete(item.camera)
    }
    refresh()
  },[refresh,hotel.id])
  useEffect(()=>{ refresh();drain(); const channel=hotelGioClient.channel('apice-housekeeping-'+hotel.id).on('postgres_changes',{event:'*',schema:'public',table:'camere_giorno',filter:`hotel_id=eq.${hotel.id}`},refresh).on('postgres_changes',{event:'*',schema:'public',table:'camere_lavoro',filter:`hotel_id=eq.${hotel.id}`},refresh).subscribe(); window.addEventListener('online',drain); return()=>{hotelGioClient.removeChannel(channel);window.removeEventListener('online',drain)} },[refresh,drain,hotel.id])
  const workByRoom=useMemo(()=>Object.fromEntries(work.map((item)=>[item.camera,item])),[work])
  const roomSet=useMemo(()=>new Set(groups.find((item)=>item.name===group)?.rooms||[]),[groups,group])
  const rooms=useMemo(()=>{
    const values=day.filter((item)=>roomSet.has(String(item.camera))).map((item)=>({...item,lavoro:workByRoom[item.camera]?.stato||(item.stato_slope==='libera'?'fatto':'dafare')}))
    const weight={b2b:0,partenza:1,arrivo:2,fermata:3,libera:5}
    return values.sort((a,b)=>order==='numero'?a.camera.localeCompare(b.camera,'it',{numeric:true}):(weight[a.stato_slope]-weight[b.stato_slope]||a.camera.localeCompare(b.camera,'it',{numeric:true})))
  },[day,workByRoom,roomSet,order])
  const setWorkState=async(camera,state)=>{const payload={hotel_id:hotel.id,camera,stato:state,da_chi:user.name,aggiornato_il:new Date().toISOString()};await cache.lavoro.put(payload);await cache.outbox.put({camera,kind:'work',payload});setMessage(`Camera ${camera}: ${workLabels[state]}`);await refresh();drain()}
  const saveDetails=async(camera,fields)=>{const payload={...fields,manuale:true,manuale_da:user.name,manuale_il:new Date().toISOString(),aggiornato_il:new Date().toISOString()};await cache.giorno.update(camera,payload);await cache.outbox.put({camera,kind:'day',payload});setOpen(null);await refresh();drain()}
  const upload=async(event)=>{const file=event.target.files?.[0];event.target.value='';if(!file)return;setUploading(true);try{const parsed=await parseWorkbook(file,hotel.id);if(parsed.kind==='revenue'){if(parsed.hotelId&&parsed.hotelId!==hotel.id){setRevenueReport(null);setMessage(`Questo report appartiene a ${parsed.structureName}. Seleziona la struttura corretta prima di caricarlo.`)}else{setRevenueReport(parsed);setMessage(`Report ${parsed.structureName}: ${parsed.rows.length} giorni caricati. Nessun dato Housekeeping modificato.`)}}else{setRevenueReport(null);const {error}=await hotelGioClient.rpc('carica_camere_giorno',{p_hotel_id:hotel.id,p_caricato_da:user.name,p_camere:parsed.rooms});setMessage(error?`Errore caricamento: ${error.message}`:`Caricate ${parsed.rooms.length} camere dal file Housekeeping`);await refresh()}}catch(error){setMessage(`File non leggibile: ${error?.message||'formato non riconosciuto'}`)}setUploading(false)}
  return <section className="housekeeping-page">
    <header><div><h1>Housekeeping</h1><p><span className={pending?'pending':'synced'}/>{pending?`${pending} modifiche in attesa di rete`:'Sincronizzato'}</p></div>{canUpload&&<><input ref={fileRef} type="file" accept=".xls,.xlsx" hidden onChange={upload}/><button className="primary" disabled={uploading} onClick={()=>fileRef.current?.click()}>{uploading?'Caricamento…':'Carica file XLS'}</button></>}</header>
    {message&&<p className="housekeeping-message" role="status">{message}</p>}
    {revenueReport ? <RevenueReport report={revenueReport} onClose={()=>setRevenueReport(null)} /> : <>
      {hotel.id === 'hotelgio' ? <div className="hk-gio-selector">
        <div className="hk-structures" aria-label="Sezione Hotel Giò">{gioSections.map((section)=>{const active=gioSectionFromGroup(group)===section;return <button className={active?'active':''} aria-pressed={active} onClick={()=>{const next=groups.find((item)=>item.name.startsWith(section));if(next)setGroup(next.name)}} key={section}>{section==='Jazz'?'🎷 Jazz':'🍷 Wine'}</button>})}</div>
        <div className="hk-floors" aria-label="Piano Hotel Giò">{groups.filter((item)=>item.name.startsWith(gioSectionFromGroup(group))).map((item)=>{const floor=gioFloorFromGroup(item.name);return <button className={group===item.name?'active':''} aria-pressed={group===item.name} onClick={()=>setGroup(item.name)} key={item.name}><strong>Piano {floor}</strong></button>})}</div>
      </div> : <div className="hk-structures" aria-label="Gruppo camere">{groups.map((item)=><button className={group===item.name?'active':''} aria-pressed={group===item.name} onClick={()=>setGroup(item.name)} key={item.name}>{item.name}</button>)}</div>}
      <div className="hk-toolbar"><strong>{hotel.id==='hotelgio'?`${gioSectionFromGroup(group)} · Piano ${gioFloorFromGroup(group)}`:(group||hotel.name)}</strong><select aria-label="Ordina camere" value={order} onChange={(e)=>setOrder(e.target.value)}><option value="urgenti">Urgenti prima</option><option value="numero">Per numero</option></select></div>
      {loading?<div className="temperature-empty">Carico Housekeeping…</div>:!groups.length?<div className="temperature-empty">Nessuna camera configurata per {hotel.name}.</div>:!rooms.length?<div className="temperature-empty">Carica il file Housekeeping di oggi per iniziare.</div>:<div className="hk-grid">{rooms.map((room)=><button type="button" className={`hk-room ${room.stato_slope} ${room.lavoro}`} key={room.camera} onClick={()=>setOpen(room)} aria-label={`Camera ${room.camera}, ${slopeLabels[room.stato_slope]}, ${workLabels[room.lavoro]}${room.note?', con nota':''}`}><div><strong>{room.camera}</strong><span>{room.tipologia||'Camera'}</span></div><b>{slopeLabels[room.stato_slope]}</b><small>{workLabels[room.lavoro]}</small>{room.note&&<em>Nota</em>}</button>)}</div>}
    </>}
    {open&&<RoomSheet room={open} canEdit={canEdit} onClose={()=>setOpen(null)} onState={(state)=>{setWorkState(open.camera,state);setOpen(null)}} onSave={(fields)=>saveDetails(open.camera,fields)}/>}  
  </section>
}

function RevenueReport({report,onClose}){
  const total=report.total||[]
  const metric=(index)=>index>=0?formatReportCell(total[index]):'—'
  const cards=[['Alloggi prenotati',metric(report.indexes.booked)],['Alloggi liberi',metric(report.indexes.free)],['Occupazione',metric(report.indexes.occupancy)],['Ricavi',report.indexes.revenue>=0?`€ ${metric(report.indexes.revenue)}`:'—'],['ADR',report.indexes.adr>=0?`€ ${metric(report.indexes.adr)}`:'—'],['RevPAR',report.indexes.revpar>=0?`€ ${metric(report.indexes.revpar)}`:'—']]
  return <section aria-label="Report occupazione e revenue" style={{marginTop:16}}>
    <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'flex-start',marginBottom:14}}><div><h2 style={{margin:0}}>{report.structureName}</h2><p style={{margin:'4px 0 0'}}>{report.period||report.title}</p></div><button className="secondary" onClick={onClose}>Chiudi report</button></div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:10,marginBottom:16}}>{cards.map(([label,value])=><article key={label} style={{border:'1px solid #d7dee5',borderRadius:14,padding:12,background:'#fff'}}><small style={{display:'block',opacity:.7}}>{label}</small><strong style={{fontSize:'1.15rem'}}>{value}</strong></article>)}</div>
    <div style={{overflowX:'auto',WebkitOverflowScrolling:'touch',border:'1px solid #d7dee5',borderRadius:14,background:'#fff'}}><table style={{borderCollapse:'collapse',minWidth:Math.max(1050,report.headers.length*105),width:'100%',fontSize:13}}><thead><tr>{report.headers.map((header,index)=><th key={`${header}-${index}`} style={{position:'sticky',top:0,textAlign:'left',padding:'10px 8px',borderBottom:'1px solid #d7dee5',background:'#f6f8fa',whiteSpace:'nowrap'}}>{header}</th>)}</tr></thead><tbody>{report.rows.map((row,rowIndex)=><tr key={rowIndex}>{row.map((value,index)=><td key={index} style={{padding:'9px 8px',borderBottom:'1px solid #edf0f2',whiteSpace:'nowrap'}}>{formatReportCell(value)}</td>)}</tr>)}{report.total&&<tr>{report.total.map((value,index)=><td key={index} style={{padding:'10px 8px',fontWeight:700,borderTop:'2px solid #c7d0d9',whiteSpace:'nowrap'}}>{formatReportCell(value)}</td>)}</tr>}</tbody></table></div>
  </section>
}

function RoomSheet({room,canEdit,onClose,onState,onSave}){
  const [fields,setFields]=useState({stato_slope:room.stato_slope,letti:room.letti||'',note:room.note||''})
  return <div className="hk-backdrop" onClick={onClose}><section className="hk-sheet" role="dialog" aria-modal="true" aria-labelledby="hk-room-title" onClick={(e)=>e.stopPropagation()}><header><div><small>Camera</small><h2 id="hk-room-title">{room.camera}</h2></div><button onClick={onClose} aria-label="Chiudi dettaglio camera">✕</button></header><div className="hk-details"><p><strong>{slopeLabels[room.stato_slope]}</strong>{room.arrivo&&` · arrivo ${room.arrivo}`}{room.partenza&&` · partenza ${room.partenza}`}</p><p>{room.tipologia||'Tipologia non indicata'}{room.letti&&` · ${room.letti}`}</p>{room.note&&<p>Note: {room.note}</p>}</div>{canEdit&&<><div className="hk-actions" aria-label="Stato pulizia">{Object.entries(workLabels).map(([key,label])=><button className={room.lavoro===key?'active':''} aria-pressed={room.lavoro===key} key={key} onClick={()=>onState(key)}>{label}</button>)}</div><form onSubmit={(e)=>{e.preventDefault();onSave(fields)}}><label>Stato soggiorno<select value={fields.stato_slope} onChange={(e)=>setFields({...fields,stato_slope:e.target.value})}>{Object.entries(slopeLabels).map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></label><label>Configurazione letti<input value={fields.letti} onChange={(e)=>setFields({...fields,letti:e.target.value})}/></label><label>Note<textarea rows="3" value={fields.note} onChange={(e)=>setFields({...fields,note:e.target.value})}/></label><button className="primary">Salva modifica</button></form></>}</section></div>
}