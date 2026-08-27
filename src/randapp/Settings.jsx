import { useEffect, useMemo, useState } from 'react'
import { HOTELS, ROLES } from '../config.js'
import { supabase, supabaseUrl } from '../supabase.js'
import { fetchUsers, insertUser, updateUserRow, updateUserPin, setUserActive, permanentlyDeleteUser, getTechnicianLink } from '../users-data.js'
import { fetchAllSensors, updateSensorVisibility, syncSensorsFromEwelink } from '../sensors-admin-data.js'
import { fetchRolePermissionRows, saveRolePermission, PERMISSION_ACTIONS, permissionLabels } from '../permissions.js'
import { Button, Card, Field, TextInput, Icon, Badge, Spinner, EmptyState, Modal, ConfirmDialog, UiSizeControl, ThemeControl } from './ui.jsx'

const NAV_ITEMS = [
  ['home', 'Home'], ['issues', 'Segnalazioni'], ['interventions', 'Interventi'], ['planning_work', 'Planning'],
  ['housekeeping', 'Housekeeping'], ['temperature', 'Temperature'], ['urgent', 'Avvisi urgenti'],
  ['reminders', 'Promemoria'], ['technicians', 'Rubrica tecnici'], ['structure', 'Cambia struttura'],
  ['profile', 'Il mio profilo'], ['manual', 'Manuale'], ['feedback', 'Feedback'],
]
const PLACEMENTS = [['bottom', 'Sotto'], ['side', 'Laterale'], ['off', 'Nascosto']]
const NAV_KEY = 'role_navigation_v1'
const ALL_HOTEL_IDS = HOTELS.map((h) => h.id)
const ROLE_PRIORITY = ['admin','Supremo','Direzione','Direttore Centro Congressi','Portiere Notturno','manutentore','Capo Governante','Governante','Reception','Isola dei Golosi','Ristorante Wine/Jazz','Colazione Jazz','Tecnico esterno']
const ACTION_LABELS = permissionLabels()
const PERMISSION_GROUPS = [
  { id:'maintenance', label:'Segnalazioni e interventi', modules:[['issues','Segnalazioni'],['interventions','Interventi']] },
  { id:'planning', label:'Planning', modules:[['planning_work','Planning lavori'],['planning_sale','Planning Sale']] },
  { id:'operations', label:'Operatività hotel', modules:[['housekeeping','Housekeeping'],['temperature','Temperature'],['technicians','Rubrica tecnici']] },
  { id:'alerts', label:'Avvisi e notifiche', modules:[['urgent','Avvisi urgenti'],['reminders','Promemoria'],['notifications','Centro notifiche']] },
  { id:'system', label:'Amministrazione', modules:[['users','Utenti'],['role_permissions','Ruoli e permessi'],['app_settings','Impostazioni app']] },
]
const ACTIONS_BY_MODULE = {
  home:['view'], issues:['view','create','edit','assign','take_charge','complete','delete'], interventions:['view','create','edit','assign','take_charge','complete','delete'],
  planning_work:['view','create','edit','assign','take_charge','complete','delete'], planning_sale:['view','create','edit','take_charge','complete','delete','manage'],
  housekeeping:['view','create','edit','complete','manage'], urgent:['view','create','edit','complete','delete','manage'], reminders:['view','create','edit','delete','manage'],
  notifications:['view','edit','manage'], temperature:['view','edit','manage'], technicians:['view','create','edit','delete','manage'], users:['view','create','edit','delete','manage'],
  role_permissions:['view','edit','manage'], app_settings:['view','edit','manage'],
}

function UsersTab() {
  const [users,setUsers]=useState([]),[loading,setLoading]=useState(true),[search,setSearch]=useState(''),[creating,setCreating]=useState(false),[message,setMessage]=useState(''),[techLink,setTechLink]=useState(null),[confirmDel,setConfirmDel]=useState(null),[openGroups,setOpenGroups]=useState({})
  const empty={name:'',role:'Reception',pin:'',hotels:[...ALL_HOTEL_IDS]}
  const [draft,setDraft]=useState(empty)
  const reload=()=>fetchUsers(ALL_HOTEL_IDS).then(r=>setUsers(r.users||[])).catch(()=>setUsers([])).finally(()=>setLoading(false))
  useEffect(()=>{reload()},[])
  const filtered=useMemo(()=>{const q=search.trim().toLocaleLowerCase('it');return q?users.filter(u=>`${u.name} ${u.role} ${u.department||''}`.toLocaleLowerCase('it').includes(q)):users},[users,search])
  const groups=useMemo(()=>{
    const hk=new Set(['Governante','Capo Governante'])
    const hkUsers=filtered.filter(u=>hk.has(u.role))
    const byHotel=HOTELS.map(h=>({role:`Housekeeping · ${h.short}`,rank:ROLE_PRIORITY.indexOf('Capo Governante'),list:hkUsers.filter(u=>(u.hotels||[]).includes(h.id)).sort((a,b)=>String(a.name).localeCompare(String(b.name),'it'))})).filter(g=>g.list.length)
    const known=ROLE_PRIORITY.filter(r=>!hk.has(r)).map(r=>({role:r,rank:ROLE_PRIORITY.indexOf(r),list:filtered.filter(u=>u.role===r).sort((a,b)=>String(a.name).localeCompare(String(b.name),'it'))})).filter(g=>g.list.length)
    const other=filtered.filter(u=>!ROLES.includes(u.role)).sort((a,b)=>String(a.name).localeCompare(String(b.name),'it'))
    return [...known,...byHotel,...(other.length?[{role:'Altro',rank:999,list:other}]:[])].sort((a,b)=>a.rank-b.rank||a.role.localeCompare(b.role,'it'))
  },[filtered])
  useEffect(()=>{if(!search.trim())return;const next={};groups.forEach(g=>{next[g.role]=true});setOpenGroups(next)},[search,groups])
  const save=async(t,c)=>{if(t.protected)return setMessage('Account protetto: non modificabile');try{await updateUserRow(t.auth_user_id||t.id,c);await reload();setMessage('Modifiche salvate')}catch(e){setMessage(e?.message||'Errore durante il salvataggio')}}
  const toggleHotel=(t,id)=>{const hotels=(t.hotels||[]).includes(id)?t.hotels.filter(x=>x!==id):[...(t.hotels||[]),id];if(!hotels.length)return setMessage('Ogni utente deve mantenere almeno una struttura');save(t,{hotels})}
  const resetPin=async t=>{const pin=window.prompt(`Nuovo PIN di 4 cifre per ${t.name}`)||'';if(!/^\d{4}$/.test(pin))return setMessage('PIN non valido');try{await updateUserPin(t.auth_user_id||t.id,pin);setMessage(`PIN di ${t.name} aggiornato`)}catch(e){setMessage(e?.message||'Errore durante il cambio PIN')}}
  const toggleActive=async t=>{try{await setUserActive(t.auth_user_id||t.id,!t.active);await reload()}catch(e){setMessage(e?.message||'Errore')}}
  const remove=async t=>{try{await permanentlyDeleteUser(t.auth_user_id||t.id);await reload();setMessage(`${t.name} eliminato`)}catch(e){setMessage(e?.message||"Errore durante l'eliminazione")}finally{setConfirmDel(null)}}
  const showLink=async t=>{try{const token=await getTechnicianLink(t.auth_user_id||t.id);setTechLink({name:t.name,url:`${window.location.origin}/tecnico/${token}`})}catch(e){setMessage(e?.message||'Errore link')}}
  const create=async e=>{e.preventDefault();if(!draft.name.trim()||!/^\d{4}$/.test(draft.pin)||!draft.hotels.length)return setMessage('Inserisci nome, PIN di 4 cifre e almeno una struttura');try{await insertUser({...draft,name:draft.name.trim(),email:'',phone:''});await reload();setDraft(empty);setCreating(false);setMessage(`${draft.name.trim()} aggiunto`)}catch(err){setMessage(err?.message||'Errore durante la creazione')}}
  if(loading)return <Spinner label="Carico gli utenti…"/>
  return <section data-testid="settings-users">
    <div className="rs-page-title"><div><h1>Utenti</h1><p>Gestisci utenti, ruoli e strutture</p></div><Button variant={creating?'ghost':'primary'} icon={creating?'close':'plus'} onClick={()=>setCreating(v=>!v)}>{creating?'Annulla':'Nuovo'}</Button></div>
    {creating&&<Card className="rs-card--pad" style={{marginBottom:14}}><form className="rs-form" onSubmit={create}><Field label="Nome"><TextInput value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></Field><Field label="Ruolo"><select className="rs-select" value={draft.role} onChange={e=>setDraft({...draft,role:e.target.value})}>{ROLE_PRIORITY.filter(r=>ROLES.includes(r)).map(r=><option key={r}>{r}</option>)}</select></Field><Field label="PIN di 4 cifre"><TextInput icon="lock" inputMode="numeric" value={draft.pin} onChange={e=>setDraft({...draft,pin:e.target.value.replace(/\D/g,'').slice(0,4)})}/></Field><fieldset className="rs-fieldset"><legend>Strutture abilitate</legend><div className="rs-hotel-toggles">{HOTELS.map(h=><button type="button" key={h.id} className={`rs-hotel-toggle ${draft.hotels.includes(h.id)?'on':''}`} onClick={()=>setDraft({...draft,hotels:draft.hotels.includes(h.id)?draft.hotels.filter(x=>x!==h.id):[...draft.hotels,h.id]})}>{draft.hotels.includes(h.id)?'✓ ':''}{h.short}</button>)}</div></fieldset><Button variant="primary">Salva utente</Button></form></Card>}
    <TextInput icon="search" value={search} placeholder="Cerca utente…" onChange={e=>setSearch(e.target.value)}/>
    {message&&<p className="rs-badge rs-badge--accent" style={{display:'inline-flex',margin:'12px 0'}}>{message}</p>}
    <div style={{marginTop:14}}>{groups.length===0?<EmptyState icon="users" title="Nessun utente"/>:groups.map(({role,list})=>{const open=Boolean(openGroups[role]);return <div className="rs-role-group" key={role}><button className={`rs-role-group__head ${open?'open':''}`} onClick={()=>setOpenGroups(c=>({...c,[role]:!open}))}><b>{role}</b><span>{list.length}</span><i><Icon name="chevronDown"/></i></button>{open&&list.map(u=><Card key={`${role}-${u.auth_user_id||u.id}`} className="rs-usercard"><div className="rs-usercard__top"><div><strong>{u.name}</strong><small>{u.department||u.role||'—'}</small>{!u.active&&<Badge tone="high">Disattivato</Badge>}</div>{u.protected&&<Badge tone="accent">Protetto</Badge>}</div><select className="rs-select" value={u.role} disabled={u.protected} onChange={e=>save(u,{role:e.target.value})}>{ROLE_PRIORITY.filter(r=>ROLES.includes(r)).map(r=><option key={r}>{r}</option>)}</select><div className="rs-hotel-toggles">{HOTELS.map(h=><button key={h.id} className={`rs-hotel-toggle ${(u.hotels||[]).includes(h.id)?'on':''}`} disabled={u.protected} onClick={()=>toggleHotel(u,h.id)}>{(u.hotels||[]).includes(h.id)?'✓ ':''}{h.short}</button>)}</div><div className="rs-usercard__actions"><Button variant="ghost" size="sm" onClick={()=>resetPin(u)} disabled={u.protected}>PIN</Button>{u.role==='Tecnico esterno'&&<Button variant="ghost" size="sm" onClick={()=>showLink(u)}>Link</Button>}<Button variant="ghost" size="sm" onClick={()=>toggleActive(u)} disabled={u.protected}>{u.active?'Disattiva':'Attiva'}</Button><Button variant="danger" size="sm" onClick={()=>setConfirmDel(u)} disabled={u.protected}>Elimina</Button></div></Card>)}</div>})}</div>
    <Modal open={!!techLink} onClose={()=>setTechLink(null)} title={techLink?`Link di ${techLink.name}`:''}><TextInput value={techLink?.url||''} readOnly onFocus={e=>e.target.select()}/><Button variant="ghost" onClick={()=>navigator.clipboard?.writeText(techLink?.url||'')}>Copia link</Button></Modal>
    <ConfirmDialog open={!!confirmDel} title="Eliminare l'utente?" danger confirmLabel="Elimina definitivamente" message={confirmDel?`${confirmDel.name} verrà eliminato definitivamente.`:''} onCancel={()=>setConfirmDel(null)} onConfirm={()=>remove(confirmDel)}/>
  </section>
}

function SensorsTab(){
  const[sensors,setSensors]=useState([]),[loading,setLoading]=useState(true),[syncing,setSyncing]=useState(false)
  useEffect(()=>{fetchAllSensors().then(r=>setSensors(r.sensors||[])).catch(()=>{}).finally(()=>setLoading(false))},[])
  const toggle=async(s,id)=>{const f={hotelgio:!!s.mostra_hotelgio,chocohotel:!!s.mostra_chocohotel,brigantino:!!s.mostra_brigantino};f[id]=!f[id];setSensors(l=>l.map(x=>x.device_id===s.device_id?{...x,[`mostra_${id}`]:f[id]}:x));await updateSensorVisibility(s.device_id,f)}
  const sync=async()=>{setSyncing(true);try{const r=await syncSensorsFromEwelink(supabaseUrl);setSensors(r.sensors||[])}finally{setSyncing(false)}}
  if(loading)return <Spinner label="Carico i sensori…"/>
  return <section data-testid="settings-sensors"><div className="rs-page-title"><div><h1>Sensori</h1><p>Visibilità dei sensori eWeLink per struttura</p></div><Button variant="ghost" icon="refresh" onClick={sync} disabled={syncing}>{syncing?'Sincronizzo…':'Sincronizza'}</Button></div>{sensors.length===0?<EmptyState icon="sensor" title="Nessun sensore">Sincronizza da eWeLink per popolare la lista.</EmptyState>:sensors.map(s=><Card key={s.device_id} className="rs-sensor"><div className="rs-sensor__info"><strong>{s.nome||s.device_id}</strong><small>{s.temperatura!=null?`${s.temperatura}°C`:'Temperatura non disponibile'}</small></div><div className="rs-hotel-toggles">{HOTELS.map(h=><button key={h.id} className={`rs-hotel-toggle ${s[`mostra_${h.id}`]?'on':''}`} onClick={()=>toggle(s,h.id)}>{s[`mostra_${h.id}`]?'✓ ':''}{h.short}</button>)}</div></Card>)}</section>
}

function NavigationTab(){
  const[role,setRole]=useState('admin'),[config,setConfig]=useState(null),[rows,setRows]=useState([]),[draftPerms,setDraftPerms]=useState({}),[dirty,setDirty]=useState({}),[openGroups,setOpenGroups]=useState({}),[status,setStatus]=useState(''),[saving,setSaving]=useState(false)
  const load=async()=>{const [permRows,navResult]=await Promise.all([fetchRolePermissionRows(),supabase?supabase.from('app_config').select('value').eq('key',NAV_KEY).maybeSingle():Promise.resolve({data:null})]);setRows(permRows);const p={};permRows.forEach(r=>{p[`${r.role}|${r.module}|${r.action}`]=Boolean(r.allowed)});setDraftPerms(p);try{setConfig(navResult?.data?.value?JSON.parse(navResult.data.value):{}}catch{setConfig({})}}
  useEffect(()=>{load().catch(e=>{setStatus(e?.message||'Errore caricamento');setConfig({})})},[])
  const permKey=(r,m,a)=>`${r}|${m}|${a}`
  const getPerm=(m,a)=>Boolean(draftPerms[permKey(role,m,a)])
  const togglePerm=(m,a)=>{if(role==='Supremo')return;const k=permKey(role,m,a);setDraftPerms(p=>({...p,[k]:!p[k]}));setDirty(d=>({...d,[k]:{role,module:m,action:a,allowed:!draftPerms[k]}}));setStatus('')}
  const placement=(r,k)=>config?.[r]?.[k]||'off'
  const bottomCount=r=>NAV_ITEMS.filter(([k])=>placement(r,k)==='bottom').length
  const setPlacement=(k,v)=>{setStatus('');if(v==='bottom'&&placement(role,k)!=='bottom'&&bottomCount(role)>=5)return setStatus('Massimo 5 voci nella barra sotto.');setConfig(c=>({...c,[role]:{...(c?.[role]||{}),[k]:v,...(k==='planning_work'?{planning_sale:v}:{})}}))}
  const saveAll=async()=>{setSaving(true);setStatus('');try{for(const change of Object.values(dirty))await saveRolePermission(change.role,change.module,change.action,change.allowed);const normalized=Object.fromEntries(Object.entries(config||{}).map(([r,v])=>[r,{...v,planning_sale:v?.planning_work||'off'}]));const{error}=await supabase.from('app_config').update({value:JSON.stringify(normalized)}).eq('key',NAV_KEY);if(error)throw error;setConfig(normalized);setDirty({});setStatus('Permessi e navigazione salvati')}catch(e){setStatus(e?.message||'Salvataggio non riuscito')}finally{setSaving(false)}}
  if(config===null)return <Spinner label="Carico ruoli e permessi…"/>
  return <section data-testid="settings-navigation"><div className="rs-page-title"><div><h1>Ruoli & Permessi</h1><p>Permessi operativi separati dalla posizione nei menu</p></div></div><Card className="rs-card--pad"><Field label="Ruolo da configurare"><select className="rs-select" value={role} onChange={e=>{setRole(e.target.value);setOpenGroups({});setStatus('')}}>{ROLE_PRIORITY.filter(r=>ROLES.includes(r)).map(r=><option key={r}>{r}</option>)}</select></Field>{role==='Supremo'&&<p className="rs-field__hint" style={{marginTop:10}}>Regola fissa: Supremo può visualizzare e inserire, senza modifica, eliminazione o gestione.</p>}</Card>
    <h2 style={{fontFamily:'Sora',fontSize:'1rem',margin:'22px 4px 10px'}}>Permessi</h2>
    <div style={{display:'grid',gap:8}}>{PERMISSION_GROUPS.map(group=>{const open=Boolean(openGroups[group.id]);return <Card key={group.id} className="rs-card--pad"><button type="button" className={`rs-role-group__head ${open?'open':''}`} style={{width:'100%'}} onClick={()=>setOpenGroups(o=>({...o,[group.id]:!open}))}><b>{group.label}</b><i><Icon name="chevronDown"/></i></button>{open&&<div style={{display:'grid',gap:12,marginTop:12}}>{group.modules.map(([module,label])=><div key={module} style={{borderTop:'1px solid var(--rs-line)',paddingTop:10}}><strong>{label}</strong><div className="rs-chips" style={{marginTop:8}}>{(ACTIONS_BY_MODULE[module]||PERMISSION_ACTIONS).map(action=>{const active=getPerm(module,action);return <button type="button" key={action} className={`rs-chip ${active?'active':''}`} disabled={role==='Supremo'} onClick={()=>togglePerm(module,action)}>{active?'✓ ':''}{ACTION_LABELS[action]||action}</button>})}</div></div>)}</div>}</Card>})}</div>
    <h2 style={{fontFamily:'Sora',fontSize:'1rem',margin:'22px 4px 10px'}}>Navigazione</h2><Card className="rs-card--pad"><p className="rs-field__hint">{bottomCount(role)}/5 voci nella barra sotto · Home viene mantenuta centrale dalla navigator.</p>{NAV_ITEMS.map(([key,label])=><div className="rs-navrow" key={key}><span>{label}</span><div className="rs-navseg">{PLACEMENTS.map(([val,l])=><button key={val} className={placement(role,key)===val?'active':''} onClick={()=>setPlacement(key,val)}>{l}</button>)}</div></div>)}{status&&<p className="rs-badge rs-badge--accent" style={{display:'inline-flex',marginTop:12}}>{status}</p>}<Button variant="primary" style={{marginTop:14}} onClick={saveAll} disabled={saving}>{saving?'Salvo…':'Salva permessi e navigazione'}</Button></Card>
  </section>
}

function AppearanceTab(){return <section data-testid="settings-appearance"><div className="rs-page-title"><div><h1>Aspetto</h1><p>Tema e dimensione interfaccia</p></div></div><Card className="rs-card--pad" style={{marginBottom:12}}><div className="rs-uisize-block"><strong>Tema</strong><ThemeControl/></div></Card><Card className="rs-card--pad"><div className="rs-uisize-block"><strong>Dimensione interfaccia</strong><UiSizeControl/></div></Card></section>}

const TABS=[{id:'users',icon:'users',label:'Utenti',render:()=> <UsersTab/>},{id:'sensors',icon:'sensor',label:'Sensori',render:()=> <SensorsTab/>},{id:'navigation',icon:'sliders',label:'Ruoli',render:()=> <NavigationTab/>},{id:'appearance',icon:'sparkles',label:'Aspetto',render:()=> <AppearanceTab/>}]
export default function Settings({initialTab='users',onExit}){const[tab,setTab]=useState(TABS.some(t=>t.id===initialTab)?initialTab:'users'),active=TABS.find(t=>t.id===tab);return <div className="rs-root"><div className="rs-app"><header className="rs-settings-head"><div className="rs-settings-head__brand"><Icon name="gear"/><div><b>Impostazioni</b><small>RandApp Manutenzione</small></div></div><Button variant="ghost" size="sm" icon="logout" onClick={onExit}>Esci</Button></header><main className="rs-content">{active?.render()}</main><nav className="rs-settings-nav">{TABS.map(t=><button key={t.id} className={`rs-navbtn ${tab===t.id?'active':''}`} onClick={()=>setTab(t.id)}><Icon name={t.icon}/><small>{t.label}</small></button>)}<button className="rs-navbtn" onClick={onExit}><Icon name="home"/><small>RandApp</small></button></nav></div></div>}
