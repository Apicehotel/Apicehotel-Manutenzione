import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../supabase.js'
import { HOTELS } from '../../config.js'
import { fetchIssues, subscribeIssues } from '../../issues-data.js'
import { fetchPlanned, subscribePlanned } from '../../planned-data.js'
import { fetchUsers } from '../../users-data.js'
import { fetchAllSensors } from '../../sensors-admin-data.js'
import RandAIKnowledgeConsole from '../console/RandAIConsole.jsx'
import './randai-control.css'

const NAV = [
  ['dashboard','Dashboard'],['issues','Segnalazioni'],['maintenance','Manutenzioni'],['knowledge','Conoscenze'],
  ['drafts','Bozze'],['approvals','Approvazioni'],['archive','Archivio'],['assets','Impianti'],
  ['deadlines','Scadenze'],['media','Media & Drive'],['sensors','Sensori'],['team','Team & ruoli'],['audit','Audit log'],
]
const HOTEL_LABELS = Object.fromEntries(HOTELS.map((hotel)=>[hotel.id,hotel.name]))
const normalize=(value)=>String(value||'').trim().toLowerCase()
const fmt=(value)=>value?new Date(value).toLocaleString('it-IT',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'}):'—'
const statusLabel=(value)=>({done:'Risolta',pending:'Da fare',in_corso:'In corso',progress:'In corso',tecnico:'Tecnico',draft:'Bozza',approved:'Approvata',archived:'Archiviata'}[value]||value||'—')

function Card({label,value,hint,tone=''}){return <article className={`rc-kpi ${tone}`}><span>{label}</span><strong>{value}</strong><small>{hint}</small></article>}
function Panel({title,meta,children,className=''}){return <section className={`rc-panel ${className}`}><header><strong>{title}</strong>{meta&&<span>{meta}</span>}</header><div className="rc-panel-body">{children}</div></section>}
function Empty({children='Nessun dato disponibile.'}){return <div className="rc-empty">{children}</div>}
function Badge({children,tone=''}){return <span className={`rc-badge ${tone}`}>{children}</span>}

function IssueTable({rows,onSelect}){
  if(!rows.length)return <Empty>Nessuna segnalazione con i filtri correnti.</Empty>
  return <div className="rc-table-wrap"><table><thead><tr><th>Hotel</th><th>Camera / zona</th><th>Problema</th><th>Priorità</th><th>Stato</th><th>Reparto</th><th>Data</th></tr></thead><tbody>{rows.map((item)=><tr key={item.id} onClick={()=>onSelect(item)}><td>{HOTEL_LABELS[item.hotelId]||item.hotelId}</td><td>{item.room||'—'}</td><td><strong>{item.title||item.category||'Segnalazione'}</strong><small>{item.category||''}</small></td><td><Badge tone={['urgente','alta'].includes(normalize(item.urgency))?'bad':normalize(item.urgency)==='media'?'warn':'good'}>{item.urgency||'—'}</Badge></td><td><Badge>{statusLabel(item.status)}</Badge></td><td>{item.department||'—'}</td><td>{item.date||fmt(item.createdAt)}</td></tr>)}</tbody></table></div>
}

function DetailDrawer({item,onClose}){
  if(!item)return null
  return <div className="rc-drawer-backdrop" onMouseDown={(event)=>{if(event.target===event.currentTarget)onClose()}}><aside className="rc-drawer"><header><div><small>{HOTEL_LABELS[item.hotelId]||item.hotelId}</small><h2>{item.title||item.category||'Segnalazione'}</h2></div><button onClick={onClose} aria-label="Chiudi">×</button></header><div className="rc-detail-grid"><div><span>Camera / zona</span><strong>{item.room||'—'}</strong></div><div><span>Priorità</span><strong>{item.urgency||'—'}</strong></div><div><span>Categoria</span><strong>{item.category||'—'}</strong></div><div><span>Stato</span><strong>{statusLabel(item.status)}</strong></div><div><span>Creato da</span><strong>{item.createdByName||'—'}</strong></div><div><span>Data</span><strong>{item.date||fmt(item.createdAt)}</strong></div></div>{item.photoData&&<img src={item.photoData} alt="Foto segnalazione"/>}{item.completionPhotoData&&<img src={item.completionPhotoData} alt="Foto completamento"/>}{item.completionNote&&<div className="rc-note"><strong>Nota completamento</strong><p>{item.completionNote}</p></div>}</aside></div>
}

export default function RandAIControlCenter(){
  const [access,setAccess]=useState({loading:true,allowed:false,hotels:[],name:''})
  const [section,setSection]=useState('dashboard'),[busy,setBusy]=useState(false),[notice,setNotice]=useState('')
  const [issues,setIssues]=useState([]),[planned,setPlanned]=useState([]),[procedures,setProcedures]=useState([]),[equipment,setEquipment]=useState([]),[documents,setDocuments]=useState([]),[users,setUsers]=useState([]),[sensors,setSensors]=useState([])
  const [query,setQuery]=useState(''),[hotelFilter,setHotelFilter]=useState('all'),[selectedIssue,setSelectedIssue]=useState(null)

  const checkAccess=useCallback(async()=>{
    if(!supabase){setAccess({loading:false,allowed:false,hotels:[],name:''});return}
    const {data:userData}=await supabase.auth.getUser();const user=userData?.user
    if(!user){setAccess({loading:false,allowed:false,hotels:[],name:''});return}
    const [{data:memberships},{data:profile}]=await Promise.all([
      supabase.from('hotel_memberships').select('hotel_id,active,can_access_admin').eq('auth_user_id',user.id).eq('active',true).eq('can_access_admin',true),
      supabase.from('profiles').select('display_name').eq('auth_user_id',user.id).maybeSingle(),
    ])
    const hotels=(memberships||[]).map((row)=>row.hotel_id).filter(Boolean)
    setAccess({loading:false,allowed:hotels.length>0,hotels,name:profile?.display_name||user.email||'Admin'})
    if(hotels.length===1)setHotelFilter(hotels[0])
  },[])

  const load=useCallback(async()=>{
    if(!supabase||!access.allowed)return
    setBusy(true);setNotice('')
    try{
      const [issueGroups,plannedGroups,proc,equip,docs,userResult,sensorResult]=await Promise.all([
        Promise.all(access.hotels.map(async(id)=>(await fetchIssues(id)).issues||[])),
        Promise.all(access.hotels.map(async(id)=>(await fetchPlanned(id)).items||[])),
        supabase.from('randai_procedures').select('id,hotel_id,title,category,area,symptom,summary,status,updated_at,approved_at').in('hotel_id',access.hotels).order('updated_at',{ascending:false}),
        supabase.from('randai_equipment').select('id,hotel_id,name,category,location,active').in('hotel_id',access.hotels).order('name'),
        supabase.from('randai_documents').select('id,procedure_id,hotel_id,equipment_id,title,source_type,source_label,external_url,media_kind,status,updated_at').in('hotel_id',access.hotels).order('updated_at',{ascending:false}),
        fetchUsers(access.hotels).catch(()=>({users:[]})),
        fetchAllSensors().catch(()=>({sensors:[]})),
      ])
      if(proc.error)throw proc.error;if(equip.error)throw equip.error;if(docs.error)throw docs.error
      setIssues(issueGroups.flat());setPlanned(plannedGroups.flat());setProcedures(proc.data||[]);setEquipment(equip.data||[]);setDocuments(docs.data||[]);setUsers(userResult.users||[]);setSensors(sensorResult.sensors||[])
    }catch(error){setNotice(`Caricamento parziale: ${error?.message||'errore non disponibile'}`)}finally{setBusy(false)}
  },[access])

  useEffect(()=>{checkAccess()},[checkAccess])
  useEffect(()=>{if(!access.allowed)return;load();const cleanups=[...access.hotels.map(id=>subscribeIssues(id,load)),...access.hotels.map(id=>subscribePlanned(id,load))];return()=>cleanups.forEach(fn=>fn?.())},[access.allowed,access.hotels.join('|'),load])

  const scoped=(items,hotelKey='hotelId')=>hotelFilter==='all'?items:items.filter((item)=>item[hotelKey]===hotelFilter)
  const match=(...values)=>!query.trim()||values.join(' ').toLowerCase().includes(query.trim().toLowerCase())
  const visibleIssues=useMemo(()=>scoped(issues).filter(i=>match(i.title,i.category,i.room,i.department,HOTEL_LABELS[i.hotelId]||'')),[issues,hotelFilter,query])
  const openIssues=visibleIssues.filter(i=>normalize(i.status)!=='done')
  const urgentIssues=openIssues.filter(i=>['urgente','alta'].includes(normalize(i.urgency)))
  const upcoming=useMemo(()=>scoped(planned).filter(i=>normalize(i.status)!=='done').sort((a,b)=>(a.scheduledAt||Infinity)-(b.scheduledAt||Infinity)),[planned,hotelFilter])
  const scopedProcedures=useMemo(()=>scoped(procedures,'hotel_id').filter(p=>match(p.title,p.category,p.area,p.symptom,p.summary)),[procedures,hotelFilter,query])
  const scopedEquipment=useMemo(()=>scoped(equipment,'hotel_id').filter(e=>match(e.name,e.category,e.location)),[equipment,hotelFilter,query])
  const scopedDocs=useMemo(()=>scoped(documents,'hotel_id').filter(d=>match(d.title,d.source_type,d.source_label,d.media_kind)),[documents,hotelFilter,query])
  const audit=useMemo(()=>[...issues.flatMap(i=>[{id:`i-${i.id}`,hotelId:i.hotelId,time:i.createdAt,text:`Segnalazione creata · ${i.title||i.category||i.id}`,who:i.createdByName||'Sistema'},...(i.completedAt?[{id:`c-${i.id}`,hotelId:i.hotelId,time:i.completedAt,text:`Segnalazione risolta · ${i.title||i.category||i.id}`,who:i.completedBy||'Sistema'}]:[])]),...procedures.map(p=>({id:`p-${p.id}`,hotelId:p.hotel_id,time:p.updated_at,text:`Conoscenza ${p.status} · ${p.title}`,who:'RandAI'}))].sort((a,b)=>new Date(b.time||0)-new Date(a.time||0)),[issues,procedures])

  if(access.loading)return <div className="rc-gate"><div>Controllo accesso RandAI…</div></div>
  if(!access.allowed)return <div className="rc-gate"><section><img src="/icons/randai-cat.webp" alt=""/><small>AREA RISERVATA</small><h1>RandAI Control Center</h1><p>Accedi prima a RandApp con un profilo abilitato all’amministrazione.</p><button onClick={()=>window.location.assign('/')}>Apri RandApp</button></section></div>

  const toolbar=<div className="rc-toolbar"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Cerca in RandAI…"/><select value={hotelFilter} onChange={e=>setHotelFilter(e.target.value)}>{access.hotels.length>1&&<option value="all">Tutte le strutture</option>}{access.hotels.map(id=><option key={id} value={id}>{HOTEL_LABELS[id]||id}</option>)}</select><button onClick={load} disabled={busy}>{busy?'Aggiorno…':'Aggiorna'}</button></div>
  const dashboard=<><div className="rc-kpis"><Card label="Segnalazioni aperte" value={openIssues.length} hint={`${urgentIssues.length} ad alta priorità`} tone={urgentIssues.length?'danger':''}/><Card label="Manutenzioni attive" value={upcoming.length} hint="programmate / da completare"/><Card label="Conoscenze" value={scopedProcedures.length} hint={`${scopedProcedures.filter(p=>p.status==='approved').length} approvate`}/><Card label="Impianti" value={scopedEquipment.filter(e=>e.active!==false).length} hint={`${scopedDocs.length} fonti collegate`}/></div><div className="rc-dashboard-grid"><Panel title="Priorità operative" meta={`${urgentIssues.length} critiche`}>{urgentIssues.length?<div className="rc-stack">{urgentIssues.slice(0,7).map(i=><button key={i.id} className="rc-row-button" onClick={()=>setSelectedIssue(i)}><span><strong>{i.title||i.category}</strong><small>{HOTEL_LABELS[i.hotelId]} · {i.room||'—'}</small></span><Badge tone="bad">{i.urgency}</Badge></button>)}</div>:<Empty>Nessuna priorità alta aperta.</Empty>}</Panel><Panel title="Prossime scadenze" meta={`${upcoming.length} attive`}><div className="rc-stack">{upcoming.slice(0,7).map(i=><div className="rc-row" key={i.id}><span><strong>{i.category||i.notes||'Intervento'}</strong><small>{HOTEL_LABELS[i.hotelId]} · {i.location||'—'}</small></span><time>{fmt(i.scheduledAt)}</time></div>)}{!upcoming.length&&<Empty/>}</div></Panel><Panel title="Conoscenza RandAI" meta={`${scopedProcedures.filter(p=>p.status==='draft').length} bozze`}><div className="rc-stack">{scopedProcedures.slice(0,7).map(p=><div className="rc-row" key={p.id}><span><strong>{p.title}</strong><small>{HOTEL_LABELS[p.hotel_id]} · {p.category||'generale'}</small></span><Badge tone={p.status==='approved'?'good':p.status==='draft'?'warn':''}>{p.status}</Badge></div>)}</div></Panel><Panel title="Copertura impianti" meta={`${scopedEquipment.length} registrati`}><div className="rc-stack">{scopedEquipment.slice(0,7).map(e=><div className="rc-row" key={e.id}><span><strong>{e.name}</strong><small>{e.location||e.category||HOTEL_LABELS[e.hotel_id]}</small></span><Badge tone={e.active===false?'':'good'}>{e.active===false?'off':'attivo'}</Badge></div>)}</div></Panel></div></>

  const sectionContent={
    dashboard,
    issues:<Panel title="Segnalazioni" meta={`${visibleIssues.length} risultati`}><IssueTable rows={visibleIssues} onSelect={setSelectedIssue}/></Panel>,
    maintenance:<Panel title="Manutenzioni programmate" meta={`${upcoming.length} attive`}><div className="rc-table-wrap"><table><thead><tr><th>Hotel</th><th>Intervento</th><th>Zona</th><th>Stato</th><th>Programmato</th><th>Assegnatari</th></tr></thead><tbody>{upcoming.map(i=><tr key={i.id}><td>{HOTEL_LABELS[i.hotelId]}</td><td><strong>{i.category||'Intervento'}</strong><small>{i.notes||''}</small></td><td>{i.location||'—'}</td><td><Badge>{statusLabel(i.status)}</Badge></td><td>{fmt(i.scheduledAt)}</td><td>{(i.assignees||[]).map(a=>a.name||a).join(', ')||'—'}</td></tr>)}</tbody></table></div>{!upcoming.length&&<Empty/>}</Panel>,
    knowledge:<div className="rc-embedded"><RandAIKnowledgeConsole/></div>,
    drafts:<Panel title="Bozze RandAI" meta={`${scopedProcedures.filter(p=>p.status==='draft').length}`}><div className="rc-stack">{scopedProcedures.filter(p=>p.status==='draft').map(p=><div className="rc-row" key={p.id}><span><strong>{p.title}</strong><small>{HOTEL_LABELS[p.hotel_id]} · {p.summary}</small></span><Badge tone="warn">bozza</Badge></div>)}</div></Panel>,
    approvals:<Panel title="Conoscenze approvate" meta={`${scopedProcedures.filter(p=>p.status==='approved').length}`}><div className="rc-stack">{scopedProcedures.filter(p=>p.status==='approved').map(p=><div className="rc-row" key={p.id}><span><strong>{p.title}</strong><small>{HOTEL_LABELS[p.hotel_id]} · {p.summary}</small></span><Badge tone="good">approvata</Badge></div>)}</div></Panel>,
    archive:<Panel title="Archivio conoscenze" meta={`${scopedProcedures.filter(p=>p.status==='archived').length}`}><div className="rc-stack">{scopedProcedures.filter(p=>p.status==='archived').map(p=><div className="rc-row" key={p.id}><span><strong>{p.title}</strong><small>{HOTEL_LABELS[p.hotel_id]} · {p.summary}</small></span><Badge>archiviata</Badge></div>)}</div></Panel>,
    assets:<div className="rc-card-grid">{scopedEquipment.map(e=><Panel key={e.id} title={e.name} meta={HOTEL_LABELS[e.hotel_id]}><p>{e.category||'Impianto'} · {e.location||'Posizione non indicata'}</p><Badge tone={e.active===false?'':'good'}>{e.active===false?'disattivato':'attivo'}</Badge></Panel>)}{!scopedEquipment.length&&<Empty/>}</div>,
    deadlines:<Panel title="Scadenze" meta={`${upcoming.length}`}><div className="rc-stack">{upcoming.map(i=><div className="rc-row" key={i.id}><span><strong>{i.category||i.notes||'Intervento'} · {i.location||'—'}</strong><small>{HOTEL_LABELS[i.hotelId]}{i.scheduledUntil?` · fino a ${fmt(i.scheduledUntil)}`:''}</small></span><time>{fmt(i.scheduledAt)}</time></div>)}</div></Panel>,
    media:<div className="rc-card-grid">{scopedDocs.map(d=><Panel key={d.id} title={d.title||d.source_label||'Documento'} meta={HOTEL_LABELS[d.hotel_id]}><p>{d.source_type||'fonte'} · {d.media_kind||'documento'}</p><div className="rc-media-actions">{d.external_url&&<a href={d.external_url} target="_blank" rel="noreferrer">Apri fonte ↗</a>}<Badge tone={d.status==='approved'?'good':''}>{d.status||'—'}</Badge></div></Panel>)}{!scopedDocs.length&&<Empty>Nessun documento collegato.</Empty>}</div>,
    sensors:<Panel title="Sensori" meta={`${sensors.length} configurati`}><div className="rc-table-wrap"><table><thead><tr><th>Sensore</th><th>Valore</th><th>Hotel Giò</th><th>Choco</th><th>Brigantino</th></tr></thead><tbody>{sensors.map((s,index)=><tr key={s.device_id||s.id||index}><td><strong>{s.nome||s.name||s.device_id}</strong></td><td>{s.temperatura??s.temperature??'—'}{(s.temperatura??s.temperature)!=null?' °C':''}</td><td>{s.mostra_hotelgio?'✓':'—'}</td><td>{s.mostra_chocohotel?'✓':'—'}</td><td>{s.mostra_brigantino?'✓':'—'}</td></tr>)}</tbody></table></div></Panel>,
    team:<Panel title="Team e ruoli" meta={`${users.length} utenti`}><div className="rc-table-wrap"><table><thead><tr><th>Utente</th><th>Ruolo</th><th>Reparto</th><th>Strutture</th><th>Stato</th></tr></thead><tbody>{users.map((u,index)=><tr key={u.id||u.auth_user_id||index}><td><strong>{u.name||u.display_name||'Utente'}</strong><small>{u.email||u.phone||''}</small></td><td>{u.role||'—'}</td><td>{u.department||'—'}</td><td>{(u.hotels||[]).map(id=>HOTEL_LABELS[id]||id).join(' · ')||'—'}</td><td><Badge tone={u.active===false?'':'good'}>{u.active===false?'disattivato':'attivo'}</Badge></td></tr>)}</tbody></table></div></Panel>,
    audit:<Panel title="Audit operativo" meta={`${audit.length} eventi`}><div className="rc-stack">{scoped(audit).filter(a=>match(a.text,a.who,HOTEL_LABELS[a.hotelId]||'')).slice(0,150).map(a=><div className="rc-row" key={a.id}><span><strong>{a.text}</strong><small>{HOTEL_LABELS[a.hotelId]} · {a.who}</small></span><time>{fmt(a.time)}</time></div>)}</div></Panel>,
  }[section]||dashboard

  return <div className="rc-shell"><aside className="rc-sidebar"><div className="rc-brand"><img src="/icons/randai-cat.webp" alt=""/><div><strong>RandAI</strong><span>Control Center</span></div></div><nav>{NAV.map(([key,label])=><button key={key} className={section===key?'active':''} onClick={()=>setSection(key)}>{label}</button>)}</nav><button className="rc-back" onClick={()=>window.location.assign('/')}>← RandApp</button></aside><main className="rc-main"><header className="rc-top"><div><small>RANDAPP · AREA AMMINISTRATIVA</small><h1>{NAV.find(([key])=>key===section)?.[1]||'Dashboard'}</h1><p>Operatività, conoscenza e manutenzione multi-hotel in un’unica console.</p></div><div className="rc-user"><strong>{access.name}</strong><span>{access.hotels.length} strutture abilitate</span></div></header>{section!=='knowledge'&&toolbar}{notice&&<div className="rc-notice">{notice}</div>}{busy&&section==='dashboard'&&<div className="rc-loading">Aggiornamento dati…</div>}{sectionContent}</main><DetailDrawer item={selectedIssue} onClose={()=>setSelectedIssue(null)}/></div>
}
