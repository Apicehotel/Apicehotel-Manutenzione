import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Dexie from 'dexie'
import { HOTEL_LOCATIONS } from './locations.js'
import { hotelGioClient } from './hotelgio-data.js'
import { exportHousekeepingYearXlsx, parseSlopePrivacyRows } from './housekeeping-report.js'
import { parseBrigantinoBookingRows } from './housekeeping-brigantino.js'
import './housekeeping-v2.css'

const workLabels = { dafare:'Da fare', corso:'In corso', fatto:'Fatta', nondist:'Non disturbare' }
const slopeLabels = { b2b:'Partenza + arrivo', partenza:'Partenza', arrivo:'Arrivo', fermata:'Fermata', libera:'Libera' }
const gioSections = ['Jazz','Wine']
const caches = new Map()

function cacheForHotel(hotelId) {
  if (caches.has(hotelId)) return caches.get(hotelId)
  const db = new Dexie(`randappHousekeepingV2-${hotelId}`)
  db.version(1).stores({ giorno:'camera', lavoro:'camera', outbox:'&key,camera,kind', failures:'&key,camera,kind' })
  caches.set(hotelId, db)
  return db
}

const groupsForHotel = (hotelId) => HOTEL_LOCATIONS[hotelId]?.roomGroups || []
const roomMetaForHotel = (hotelId) => Object.fromEntries(groupsForHotel(hotelId).flatMap((group) => group.rooms.map((room) => [String(room), { group:group.name }])))
const gioSectionFromGroup = (value) => gioSections.find((section) => String(value || '').startsWith(section)) || 'Jazz'
const gioFloorFromGroup = (value) => Number(String(value || '').match(/P(\d+)/)?.[1] || 1)
const same = (a,b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
const permanentSyncError = (error) => /row level security|permission denied|forbidden|unauthorized|invalid input|not-null|not null|check constraint|violates.*constraint/i.test(String(error?.message || error || ''))
const actorId = (user) => {
  const value = user?.auth_user_id || user?.authUserId || user?.id || null
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '')) ? value : null
}
const isRole = (user, ...roles) => roles.includes(user?.role)
const canWork = (user) => isRole(user,'Governante','Capo Governante','Reception','Direzione','admin') || ['Governante','Reception'].includes(user?.department)
const canManageRoom = (user) => isRole(user,'Reception','Direzione','admin') || user?.department === 'Reception'
const canUpload = (user) => isRole(user,'Reception','Direzione','admin') || user?.department === 'Reception'
const canExport = (user) => isRole(user,'Reception','Direzione','admin') || user?.department === 'Reception'
const shouldNotifyHead = (user) => isRole(user,'Reception','Direzione','admin') || user?.department === 'Reception'

function currentYear() { return new Date().getFullYear() }
function dateOnly(value) {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? String(value).slice(0,5) : date.toLocaleDateString('it-IT',{day:'2-digit',month:'2-digit'})
}
function textValue(value) { return value == null ? '' : String(value).trim() }
function reportHotelId(label) {
  const value=textValue(label).toLowerCase().replace(/[^a-z0-9à-ù]/g,'')
  if(value.includes('choco'))return'chocohotel'
  if(value.includes('brigantino'))return'brigantino'
  if(value.includes('gio')||value.includes('giò'))return'hotelgio'
  return null
}
function parseRevenueReport(rows) {
  const flattened=rows.slice(0,14).flat().map(textValue).join(' ').toLowerCase()
  if(!flattened.includes('occupazione e revenue'))return null
  const structureName=textValue(rows[0]?.[0])||'Struttura'
  const headerIndex=rows.findIndex((row)=>textValue(row?.[0]).toLowerCase()==='data'&&row.some((cell)=>textValue(cell).toLowerCase().includes('alloggi prenotati')))
  if(headerIndex<0)throw new Error('Intestazioni del report non riconosciute')
  const top=rows[headerIndex]||[],sub=rows[headerIndex+1]||[]
  const width=Math.max(top.length,sub.length,...rows.slice(headerIndex+2).map((row)=>row.length))
  const headers=Array.from({length:width},(_,index)=>index===0?'Data':textValue(sub[index])||textValue(top[index])||`Colonna ${index+1}`)
  const body=[]
  for(const row of rows.slice(headerIndex+2)){
    const first=textValue(row?.[0]);if(!first||first.toLowerCase()==='totale')continue
    const parsed=row[0] instanceof Date?row[0]:new Date(row[0]);if(Number.isNaN(parsed.getTime()))continue
    const values=Array.from({length:width},(_,index)=>row[index]??'');values[0]=parsed;body.push(values)
  }
  if(!body.length)throw new Error('Il report non contiene righe giornaliere leggibili')
  return {kind:'revenue',hotelId:reportHotelId(structureName),structureName,headers,rows:body}
}
async function parseWorkbook(file, hotelId) {
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(await file.arrayBuffer(), { type:'array', cellDates:true })
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header:1, raw:true, defval:'' })
  const brigantino = parseBrigantinoBookingRows(rows)
  if (brigantino) {
    if (hotelId !== 'brigantino') return { ...brigantino, wrongHotel:true }
    return brigantino
  }
  const revenue = parseRevenueReport(rows)
  if (revenue) return revenue
  return { kind:'housekeeping', rooms:parseSlopePrivacyRows(rows, roomMetaForHotel(hotelId)) }
}

async function notifyHeadHousekeeper(hotelId, camera, changes, userName) {
  const readable = changes.map(({label,before,after}) => `${label}: ${before || '—'} → ${after || '—'}`).join(' · ')
  const { error } = await hotelGioClient.functions.invoke('ntfy-alert', { body:{ hotel_id:hotelId, channel:'housekeeping', title:`Housekeeping · Camera ${camera}`, message:`Modifica da ${userName || 'Reception'} · ${readable}`, priority:4 } })
  if (error) throw error
}

export function Housekeeping({ user, hotel }) {
  const cache = useMemo(() => cacheForHotel(hotel.id), [hotel.id])
  const groups = useMemo(() => groupsForHotel(hotel.id), [hotel.id])
  const [day,setDay] = useState([])
  const [work,setWork] = useState([])
  const [loading,setLoading] = useState(true)
  const [group,setGroup] = useState(groups[0]?.name || '')
  const [order,setOrder] = useState('urgenti')
  const [open,setOpen] = useState(null)
  const [pending,setPending] = useState(0)
  const [blocked,setBlocked] = useState(0)
  const [message,setMessage] = useState('')
  const [uploading,setUploading] = useState(false)
  const [exporting,setExporting] = useState(false)
  const [year,setYear] = useState(currentYear())
  const [localReport,setLocalReport] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => { setGroup(groups[0]?.name || ''); setLocalReport(null) }, [hotel.id, groups])

  const loadLocal = useCallback(async () => {
    const [g,w,p,b] = await Promise.all([cache.giorno.toArray(),cache.lavoro.toArray(),cache.outbox.count(),cache.failures.count()])
    setDay(g);setWork(w);setPending(p);setBlocked(b);setLoading(false)
  },[cache])

  const refresh = useCallback(async () => {
    if (navigator.onLine) {
      const [{data:g,error:ge},{data:w,error:we}] = await Promise.all([
        hotelGioClient.from('camere_giorno').select('hotel_id,camera,struttura,piano,tipologia,stato_slope,letti,arrivo,partenza,operational_note,manuale,manuale_da,manuale_il,aggiornato_il').eq('hotel_id',hotel.id),
        hotelGioClient.from('camere_lavoro').select('*').eq('hotel_id',hotel.id),
      ])
      if (!ge && g) { await cache.giorno.clear(); if(g.length)await cache.giorno.bulkPut(g) }
      if (!we && w) { await cache.lavoro.clear(); if(w.length)await cache.lavoro.bulkPut(w) }
    }
    await loadLocal()
  },[cache,hotel.id,loadLocal])

  const drain = useCallback(async () => {
    if (!navigator.onLine) return
    for (const item of await cache.outbox.toArray()) {
      try {
        if (item.baseValues) {
          const table=item.kind==='work'?'camere_lavoro':'camere_giorno'
          const {data:remote,error}=await hotelGioClient.from(table).select('*').eq('hotel_id',hotel.id).eq('camera',item.camera).maybeSingle()
          if(error)throw error
          if(remote){
            const conflicts=Object.keys(item.baseValues).filter((field)=>!same(remote[field],item.baseValues[field]))
            if(conflicts.length){const err=new Error(`Conflitto camera ${item.camera}: ${conflicts.join(', ')}`);err.code='OFFLINE_CONFLICT';throw err}
          }
        }
        const result=item.kind==='work'
          ? await hotelGioClient.from('camere_lavoro').upsert(item.payload)
          : await hotelGioClient.from('camere_giorno').update(item.payload).eq('hotel_id',hotel.id).eq('camera',item.camera)
        if(result.error)throw result.error
        if(item.notify?.length) {
          try {
            await hotelGioClient.from('housekeeping_change_events').insert(item.notify.map((change)=>({hotel_id:hotel.id,camera:item.camera,changed_by_user_id:actorId(user),changed_by_name:user?.name||'Utente',changed_by_role:user?.role||user?.department||'Utente',field_name:change.field,old_value:change.before,new_value:change.after})))
            await notifyHeadHousekeeper(hotel.id,item.camera,item.notify,user?.name)
          } catch (notifyError) { console.warn('Housekeeping ntfy',notifyError) }
        }
        await cache.outbox.delete(item.key)
      } catch(error) {
        if(error?.code==='OFFLINE_CONFLICT'||permanentSyncError(error)) {
          await cache.failures.put({...item,error:String(error?.message||error),failedAt:Date.now()});await cache.outbox.delete(item.key)
          setMessage(`Camera ${item.camera}: modifica bloccata, richiede verifica`)
        } else {
          await cache.outbox.update(item.key,{attempts:Number(item.attempts||0)+1,lastError:String(error?.message||error)});break
        }
      }
    }
    await refresh()
  },[cache,hotel.id,refresh,user])

  useEffect(() => {
    refresh();drain()
    const channel=hotelGioClient.channel(`hk-v2-${hotel.id}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'camere_giorno',filter:`hotel_id=eq.${hotel.id}`},refresh)
      .on('postgres_changes',{event:'*',schema:'public',table:'camere_lavoro',filter:`hotel_id=eq.${hotel.id}`},refresh)
      .subscribe()
    const retry=()=>{if(navigator.onLine)drain()}
    const visible=()=>{if(document.visibilityState==='visible')retry()}
    window.addEventListener('online',retry);window.addEventListener('focus',retry);document.addEventListener('visibilitychange',visible)
    const timer=setInterval(retry,15000)
    return()=>{hotelGioClient.removeChannel(channel);window.removeEventListener('online',retry);window.removeEventListener('focus',retry);document.removeEventListener('visibilitychange',visible);clearInterval(timer)}
  },[drain,hotel.id,refresh])

  const workByRoom=useMemo(()=>Object.fromEntries(work.map((row)=>[String(row.camera),row])),[work])
  const roomSet=useMemo(()=>new Set(groups.find((item)=>item.name===group)?.rooms?.map(String)||[]),[groups,group])
  const rooms=useMemo(()=>{
    const weight={b2b:0,partenza:1,arrivo:2,fermata:3,libera:5}
    return day.filter((item)=>roomSet.has(String(item.camera))).map((item)=>({...item,lavoro:workByRoom[String(item.camera)]?.stato||(item.stato_slope==='libera'?'fatto':'dafare')})).sort((a,b)=>order==='numero'?String(a.camera).localeCompare(String(b.camera),'it',{numeric:true}):(weight[a.stato_slope]-weight[b.stato_slope]||String(a.camera).localeCompare(String(b.camera),'it',{numeric:true})))
  },[day,roomSet,workByRoom,order])

  const setWorkState=async(camera,state)=>{
    const current=workByRoom[String(camera)]
    const payload={hotel_id:hotel.id,camera:String(camera),stato:state,da_chi:user?.name||'Utente',aggiornato_il:new Date().toISOString(),updated_by_user_id:actorId(user)}
    await cache.lavoro.put(payload)
    await cache.outbox.put({key:`work:${camera}`,camera:String(camera),kind:'work',payload,baseValues:current?{stato:current.stato}:null,attempts:0})
    setMessage(`Camera ${camera}: ${workLabels[state]}`);setOpen(null);await loadLocal();drain()
  }

  const saveDetails=async(camera,fields)=>{
    const current=day.find((item)=>String(item.camera)===String(camera));if(!current)return
    const allowedFields=canManageRoom(user)?['stato_slope','letti','operational_note']:['operational_note']
    const clean=Object.fromEntries(allowedFields.map((field)=>[field,fields[field]??'']))
    const changes=allowedFields.filter((field)=>!same(current[field]??'',clean[field]??'')).map((field)=>({field,label:{stato_slope:'Stato',letti:'Letti',operational_note:'Nota operativa'}[field]||field,before:current[field]??'',after:clean[field]??''}))
    if(!changes.length){setOpen(null);return}
    const payload={...clean,manuale:true,manuale_da:user?.name||'Utente',manuale_il:new Date().toISOString(),aggiornato_il:new Date().toISOString()}
    await cache.giorno.update(String(camera),payload)
    await cache.outbox.put({key:`day:${camera}`,camera:String(camera),kind:'day',payload,baseValues:Object.fromEntries(changes.map((change)=>[change.field,current[change.field]??''])),attempts:0,notify:shouldNotifyHead(user)?changes:null})
    setOpen(null);setMessage(`Camera ${camera}: modifica salvata`);await loadLocal();drain()
  }

  const upload=async(event)=>{
    const file=event.target.files?.[0];event.target.value='';if(!file)return
    setUploading(true);setMessage('');setLocalReport(null)
    try{
      const parsed=await parseWorkbook(file,hotel.id)
      if(parsed.kind==='brigantino-report') {
        if(parsed.wrongHotel){setMessage('Questo è un file del Brigantino. Seleziona Hotel Il Brigantino prima di caricarlo.');return}
        setLocalReport(parsed)
        setMessage(`Brigantino: ${parsed.rows.length} gruppi letti. “*” = letto fisso; suffissi numerici ignorati. Il file resta locale perché è un report prenotazioni, non uno stato camere.`)
        return
      }
      if(parsed.kind==='revenue') {
        if(parsed.hotelId&&parsed.hotelId!==hotel.id){setMessage(`Il report appartiene a ${parsed.structureName}. Seleziona la struttura corretta.`);return}
        setLocalReport(parsed);setMessage(`Report ${parsed.structureName}: ${parsed.rows.length} giorni letti localmente.`);return
      }
      if(!parsed.rooms?.length)throw new Error('Nessuna camera riconosciuta nel file')
      const {error}=await hotelGioClient.rpc('carica_camere_giorno',{p_hotel_id:hotel.id,p_caricato_da:user?.name||'Utente',p_camere:parsed.rooms})
      if(error)throw error
      setMessage(`Caricate ${parsed.rooms.length} camere. Dati ospite esclusi dal trasferimento.`);await refresh()
    }catch(error){setMessage(`File non leggibile: ${error?.message||'formato non riconosciuto'}`)}finally{setUploading(false)}
  }

  const exportYear=async()=>{
    setExporting(true);setMessage('')
    try{
      const start=`${year}-01-01`,end=`${year}-12-31`
      const {data,error}=await hotelGioClient.from('housekeeping_completions').select('*').eq('hotel_id',hotel.id).gte('work_date',start).lte('work_date',end).order('work_date')
      if(error)throw error
      await exportHousekeepingYearXlsx({hotelName:hotel.name,year,records:data||[]})
      setMessage(`Resoconto Housekeeping ${year} generato.`)
    }catch(error){setMessage(`Export non riuscito: ${error?.message||error}`)}finally{setExporting(false)}
  }

  const retryBlocked=async()=>{
    const failures=await cache.failures.toArray();if(!failures.length)return
    await cache.outbox.bulkPut(failures.map(({error:_,failedAt:__,...item})=>({...item,attempts:0,lastError:null})))
    await cache.failures.clear();await loadLocal();drain()
  }

  return <section className="hk2-page" data-testid="housekeeping-v2">
    <header className="hk2-head">
      <div><h1>Housekeeping</h1><p><span className={blocked?'hk2-dot blocked':pending?'hk2-dot pending':'hk2-dot synced'}/>{blocked?`${blocked} modifiche da verificare`:pending?`${pending} modifiche in attesa`:'Sincronizzato'}</p></div>
      <div className="hk2-head-actions">
        {canExport(user)&&<div className="hk2-export"><select aria-label="Anno resoconto" value={year} onChange={(e)=>setYear(Number(e.target.value))}>{[currentYear()-1,currentYear(),currentYear()+1].map((value)=><option value={value} key={value}>{value}</option>)}</select><button type="button" className="hk2-secondary" disabled={exporting} onClick={exportYear}>{exporting?'Creo Excel…':'Resoconto anno'}</button></div>}
        {canUpload(user)&&<><input ref={fileRef} type="file" accept=".xls,.xlsx" hidden onChange={upload}/><button type="button" className="hk2-primary" disabled={uploading} onClick={()=>fileRef.current?.click()}>{uploading?'Carico…':'Carica Housekeeping'}</button></>}
      </div>
    </header>

    {canUpload(user)&&<div className="hk2-upload-card"><div><strong>Aggiorna Housekeeping</strong><span>Reception e Direzione caricano manualmente il file .xls/.xlsx della struttura selezionata.</span></div><button type="button" className="hk2-primary" disabled={uploading} onClick={()=>fileRef.current?.click()}>{uploading?'Lettura file…':'Scegli file'}</button></div>}
    {blocked>0&&<button type="button" className="hk2-secondary" onClick={retryBlocked}>Riprova modifiche bloccate</button>}
    {message&&<p className="hk2-message" role="status">{message}</p>}

    {localReport?<LocalReport report={localReport} onClose={()=>setLocalReport(null)}/>:<>
      {hotel.id==='hotelgio'?<div className="hk2-selectors"><div className="hk2-segment">{gioSections.map((section)=>{const active=gioSectionFromGroup(group)===section;return <button type="button" className={active?'active':''} key={section} onClick={()=>{const next=groups.find((item)=>item.name.startsWith(section));if(next)setGroup(next.name)}}>{section}</button>})}</div><div className="hk2-floors">{groups.filter((item)=>item.name.startsWith(gioSectionFromGroup(group))).map((item)=><button type="button" className={group===item.name?'active':''} key={item.name} onClick={()=>setGroup(item.name)}>P{gioFloorFromGroup(item.name)}</button>)}</div></div>:<div className="hk2-floors">{groups.map((item)=><button type="button" className={group===item.name?'active':''} key={item.name} onClick={()=>setGroup(item.name)}>{item.name}</button>)}</div>}
      <div className="hk2-toolbar"><strong>{hotel.id==='hotelgio'?`${gioSectionFromGroup(group)} · Piano ${gioFloorFromGroup(group)}`:group||hotel.name}</strong><select aria-label="Ordina camere" value={order} onChange={(e)=>setOrder(e.target.value)}><option value="urgenti">Urgenti prima</option><option value="numero">Per numero</option></select></div>
      {loading?<div className="hk2-empty">Carico Housekeeping…</div>:!rooms.length?<div className="hk2-empty">{canUpload(user)?'Nessuna camera caricata. Usa “Scegli file” qui sopra.':'Nessuna camera disponibile per questa sezione.'}</div>:<div className="hk2-grid">{rooms.map((room)=><button type="button" key={room.camera} className={`hk2-room hk2-room--${room.lavoro} hk2-room--${room.stato_slope}`} onClick={()=>setOpen(room)}><span className="hk2-room-number">{room.camera}</span><span className="hk2-room-type">{room.tipologia||'Camera'}</span><span className="hk2-room-slope">{slopeLabels[room.stato_slope]||room.stato_slope}</span><span className="hk2-room-work">{workLabels[room.lavoro]||room.lavoro}</span>{room.operational_note&&<span className="hk2-room-note">Nota</span>}</button>)}</div>}
    </>}
    {open&&<RoomSheet room={open} workAllowed={canWork(user)} manageAllowed={canManageRoom(user)} onClose={()=>setOpen(null)} onState={setWorkState} onSave={saveDetails}/>} 
  </section>
}

function RoomSheet({room,workAllowed,manageAllowed,onClose,onState,onSave}) {
  const [fields,setFields]=useState({stato_slope:room.stato_slope||'libera',letti:room.letti||'',operational_note:room.operational_note||''})
  const stateEntries=Object.entries(workLabels).filter(([key])=>key!=='nondist'||room.stato_slope==='fermata')
  return <div className="hk2-backdrop" onClick={onClose}><section className="hk2-sheet" role="dialog" aria-modal="true" aria-labelledby="hk2-title" onClick={(e)=>e.stopPropagation()}><header><div><small>Camera</small><h2 id="hk2-title">{room.camera}</h2></div><button type="button" className="hk2-close" onClick={onClose} aria-label="Chiudi">×</button></header><div className="hk2-detail"><strong>{room.tipologia||'Camera'}</strong><span>{slopeLabels[room.stato_slope]||room.stato_slope}{room.arrivo?` · arrivo ${dateOnly(room.arrivo)}`:''}{room.partenza?` · partenza ${dateOnly(room.partenza)}`:''}</span>{room.letti&&<span>Letti: {room.letti}</span>}{room.operational_note&&<p><b>Nota operativa:</b> {room.operational_note}</p>}</div>{workAllowed&&<div className="hk2-actions">{stateEntries.map(([key,label])=><button type="button" className={room.lavoro===key?'active':''} key={key} onClick={()=>onState(room.camera,key)}>{label}</button>)}</div>}{workAllowed&&<form className="hk2-form" onSubmit={(e)=>{e.preventDefault();onSave(room.camera,fields)}}>{manageAllowed&&<><label>Stato soggiorno<select value={fields.stato_slope} onChange={(e)=>setFields({...fields,stato_slope:e.target.value})}>{Object.entries(slopeLabels).map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></label><label>Configurazione letti<input value={fields.letti} onChange={(e)=>setFields({...fields,letti:e.target.value})}/></label></>}<label>Note operative RandApp<textarea rows="3" value={fields.operational_note} onChange={(e)=>setFields({...fields,operational_note:e.target.value})} placeholder="Solo informazioni operative, nessun dato ospite"/></label><button type="submit" className="hk2-primary">Salva modifica</button></form>}</section></div>
}

function LocalReport({report,onClose}) {
  const brigantino=report.kind==='brigantino-report'
  return <section className="hk2-revenue"><div className="hk2-revenue-head"><div><h2>{report.structureName}</h2><p>{brigantino?'Report Prenotazioni normalizzato localmente':`${report.rows.length} giorni letti dal file`}</p></div><button type="button" className="hk2-secondary" onClick={onClose}>Chiudi</button></div>{brigantino&&<p className="hk2-message">Regole applicate: * = letto fisso; suffissi numerici finali ignorati; (n.a.) e TOTALI esclusi.</p>}<div className="hk2-table-wrap"><table><thead><tr>{report.headers.map((header,index)=><th key={`${header}-${index}`}>{header}</th>)}</tr></thead><tbody>{report.rows.map((row,index)=><tr key={index}>{row.map((value,col)=><td key={col}>{value instanceof Date?value.toLocaleDateString('it-IT'):String(value??'')}</td>)}</tr>)}</tbody></table></div></section>
}
