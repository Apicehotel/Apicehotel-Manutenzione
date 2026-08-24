import { useEffect, useMemo, useState } from 'react'
import { HOTELS } from './config.js'
import { fetchDirectory, fetchUsers } from './users-data.js'
import { loginWithPin, loginAdmin, signOutSupabase } from './auth-data.js'
import { fetchAllSensors, updateSensorVisibility } from './sensors-admin-data.js'
import { loadSession, saveSession, clearSession } from './session.js'

const logoFor = (hotelId) => ({
  hotelgio: '/logos/randapp-hotelgio.webp',
  chocohotel: '/logos/randapp-chocohotel.webp',
  brigantino: '/logos/randapp-brigantino.webp',
}[hotelId] || '/logos/apicehotel-mascot.png')

const normalize = (v) => String(v || '').trim().toLocaleLowerCase('it')

async function loadDirectoryAll() {
  const rows = await Promise.all(HOTELS.map(async (hotel) => {
    try {
      const result = await fetchDirectory(hotel.id)
      return { hotelId: hotel.id, users: result?.users || [] }
    } catch { return { hotelId: hotel.id, users: [] } }
  }))
  const map = new Map()
  rows.forEach(({ hotelId, users }) => users.forEach((u) => {
    const key = u.auth_user_id || u.legacy_id || u.id || normalize(u.name)
    if (!key) return
    const current = map.get(key) || { ...u, hotels: [] }
    current.hotels = Array.from(new Set([...(current.hotels || []), hotelId, ...(Array.isArray(u.hotels) ? u.hotels : [])]))
    map.set(key, current)
  }))
  return Array.from(map.values()).sort((a,b) => String(a.name||'').localeCompare(String(b.name||''),'it'))
}

function Brand() {
  return <section className="clean-brand">
    <img src="/logos/apicehotel-mascot.png" alt="ApiceHotel" />
    <div><strong>RandApp</strong><span>Manutenzione</span><p>◇ Piattaforma per la gestione e manutenzione delle strutture</p></div>
  </section>
}

function Login({ onLogged }) {
  const [directory,setDirectory] = useState([])
  const [user,setUser] = useState('')
  const [pin,setPin] = useState('')
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  const [settings,setSettings] = useState(false)
  useEffect(()=>{ loadDirectoryAll().then(setDirectory).catch(()=>setDirectory([])) },[])
  const suggestions = useMemo(()=> user ? directory.filter(u=>normalize(u.name).includes(normalize(user))).slice(0,6) : [],[directory,user])
  const submit = async (e) => {
    e.preventDefault(); setError('')
    const selected = directory.find(u=>normalize(u.name)===normalize(user))
    if (!selected) return setError('Seleziona un utente valido')
    if (pin.length!==4) return setError('Inserisci un PIN di 4 cifre')
    setBusy(true)
    let last
    for (const hotelId of selected.hotels || []) {
      try {
        const auth = await loginWithPin({hotelId,userId:selected.legacy_id||selected.id,pin})
        saveSession({hotelId,userId:auth?.user?.id||selected.id,createdAt:Date.now()})
        onLogged?.(); return
      } catch(e2){ last=e2 }
    }
    console.warn(last); setError('Utente o PIN non validi'); setBusy(false)
  }
  if (settings) return <AdminGate onBack={()=>setSettings(false)} />
  return <main className="clean-login"><Brand/><section className="clean-login-card">
    <header><h1>Bentornato</h1><p>Accedi per continuare</p></header>
    <form onSubmit={submit}>
      <div className="clean-field"><span>♙</span><input value={user} onChange={e=>setUser(e.target.value)} placeholder="Utente" autoComplete="username" /></div>
      {user && suggestions.length>0 && <div className="clean-suggestions">{suggestions.map(u=><button key={u.id||u.name} type="button" onClick={()=>setUser(u.name)}><b>{u.name}</b><small>{u.role||''}</small></button>)}</div>}
      <div className="clean-field"><span>▣</span><input value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="PIN" inputMode="numeric" autoComplete="current-password" /></div>
      {error && <p className="clean-error">{error}</p>}
      <button className="clean-primary" disabled={busy}>{busy?'ACCESSO…':'ACCEDI'} <b>→</b></button>
    </form>
    <div className="clean-divider"><span>oppure</span></div>
    <button className="clean-settings-link" onClick={()=>setSettings(true)}><span>⚙</span><div><b>Impostazioni</b><small>Configura l'app e le preferenze</small></div><i>›</i></button>
  </section></main>
}

function AdminGate({onBack}) {
  const [pin,setPin]=useState(''); const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [ok,setOk]=useState(false)
  const submit=async(e)=>{e.preventDefault();setError('');setBusy(true);try{await loginAdmin(pin);setOk(true)}catch{setError('PIN amministratore non valido')}finally{setBusy(false)}}
  if(ok) return <SettingsApp onExit={onBack}/>
  return <main className="clean-login"><Brand/><section className="clean-login-card clean-admin-gate"><button className="clean-text-back" onClick={onBack}>← RandApp</button><header><h1>Setting</h1><p>Accesso protetto</p></header><form onSubmit={submit}><div className="clean-field"><span>▣</span><input value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="PIN amministratore" inputMode="numeric" /></div>{error&&<p className="clean-error">{error}</p>}<button className="clean-primary" disabled={busy}>{busy?'ACCESSO…':'ENTRA'}</button></form></section></main>
}

function Header({user,hotel,onSwitch,onMenu}) {
  return <header className="clean-app-header"><button className="clean-hotel-chip" onClick={onSwitch}><img src={logoFor(hotel.id)} alt={hotel.name}/><span><b>{hotel.name}</b><small>{user?.name||'Utente'} · {user?.role||''}</small></span><i>⌄</i></button><button className="clean-icon-btn" onClick={onMenu}>☰</button></header>
}

function BottomNav({view,setView,onCreate}) {
  const items=[['issues','▤','Segnalazioni'],['planning','⌁','Interventi'],['home','⌂','Home'],['calendar','□','Planning'],['menu','☰','Menu']]
  return <nav className="clean-bottom-nav">{items.map(([id,ic,label])=><button key={id} className={view===id?'active':''} onClick={()=>setView(id)}><span>{ic}</span><small>{label}</small></button>)}<button className="clean-fab" onClick={onCreate}>+</button></nav>
}

function HotelSheet({hotels,current,onSelect,onClose}) {return <div className="clean-overlay" onClick={onClose}><section className="clean-sheet" onClick={e=>e.stopPropagation()}><div className="clean-sheet-handle"/><h3>Cambia struttura</h3>{hotels.map(id=>{const h=HOTELS.find(x=>x.id===id);if(!h)return null;return <button key={id} className={id===current?'selected':''} onClick={()=>onSelect(id)}><img src={logoFor(id)} alt=""/><span><b>{h.name}</b><small>{id===current?'Struttura attiva':'Passa a questa struttura'}</small></span><i>{id===current?'✓':'›'}</i></button>})}</section></div>}

function Drawer({open,onClose,onSettings,onLogout}) {if(!open)return null;return <div className="clean-overlay" onClick={onClose}><aside className="clean-drawer" onClick={e=>e.stopPropagation()}><div className="clean-drawer-head"><strong>RandApp</strong><button onClick={onClose}>×</button></div>{['Avvisi urgenti','Planning lavori','Planning sale','Temperature','Housekeeping','Rubrica tecnici'].map(x=><button key={x}><span>{x}</span><i>›</i></button>)}<div className="clean-drawer-spacer"/><button onClick={onSettings}><span>Impostazioni</span><i>›</i></button><button className="danger" onClick={onLogout}><span>Esci</span><i>→</i></button></aside></div>}

function Home({user,hotel}) {return <div className="clean-home"><section className="clean-hero"><h1>Ciao, {user?.name?.split(' ')[0]||'Utente'}</h1><p>{hotel.name} · ecco la situazione di oggi</p></section><div className="clean-stats">{[['▤','Segnalazioni aperte','0','Da fare, in attesa o dal tecnico'],['♧','Urgenti','0','Nessun avviso attivo'],['⌁','Interventi di oggi','0','Pianificati per oggi']].map(([i,t,n,s])=><article key={t}><div className="clean-stat-icon">{i}</div><b className="clean-count">{n}</b><h3>{t}</h3><p>{s}</p></article>)}</div><section className="clean-section"><h2>Azioni rapide</h2><button className="clean-primary compact">+ Nuova segnalazione</button></section><section className="clean-section"><h2>Attività recenti</h2><div className="clean-list"><button><span><b>Camera · 101</b><small>Sostituzione miscelatore lavandino bagno</small></span><i>›</i></button><button><span><b>Camera · 202</b><small>Controllo manutenzione</small></span><i>›</i></button></div></section></div>}

function Placeholder({title}) {return <section className="clean-placeholder"><div><span>◇</span><h2>{title}</h2><p>Questa sezione verrà collegata alla logica esistente senza riutilizzare la vecchia UI.</p></div></section>}

function MainApp({onSessionEnd}) {
  const [session,setSession]=useState(loadSession())
  const [user,setUser]=useState(null)
  const [view,setView]=useState('home')
  const [sheet,setSheet]=useState(false); const [drawer,setDrawer]=useState(false); const [settings,setSettings]=useState(false)
  const hotel=HOTELS.find(h=>h.id===session?.hotelId)||HOTELS[0]
  useEffect(()=>{if(!session)return;fetchDirectory(session.hotelId).then(({users})=>setUser((users||[]).find(u=>u.auth_user_id===session.userId||u.id===session.userId)||users?.[0]||null)).catch(()=>{})},[session])
  const allowedHotels=Array.from(new Set([session?.hotelId,...(user?.hotels||[])]).values()).filter(Boolean)
  const switchHotel=(id)=>{const next={...session,hotelId:id};saveSession(next);setSession(next);setSheet(false)}
  const logout=async()=>{await signOutSupabase();clearSession();onSessionEnd?.()}
  if(settings) return <AdminGate onBack={()=>setSettings(false)}/>
  return <div className="clean-app"><Header user={user} hotel={hotel} onSwitch={()=>setSheet(true)} onMenu={()=>setDrawer(true)}/><main className="clean-content">{view==='home'?<Home user={user} hotel={hotel}/>:<Placeholder title={{issues:'Segnalazioni',planning:'Interventi',calendar:'Planning',menu:'Menu'}[view]||'RandApp'}/>}</main><BottomNav view={view} setView={(v)=>v==='menu'?setDrawer(true):setView(v)} onCreate={()=>setView('issues')}/>{sheet&&<HotelSheet hotels={allowedHotels} current={session.hotelId} onSelect={switchHotel} onClose={()=>setSheet(false)}/>}<Drawer open={drawer} onClose={()=>setDrawer(false)} onSettings={()=>{setDrawer(false);setSettings(true)}} onLogout={logout}/></div>
}

function SettingsApp({onExit}) {
  const [tab,setTab]=useState('users'); const [users,setUsers]=useState([]); const [sensors,setSensors]=useState([]); const [loading,setLoading]=useState(true)
  useEffect(()=>{Promise.all([fetchUsers(HOTELS.map(h=>h.id)).then(r=>setUsers(r.users||[])).catch(()=>setUsers([])),fetchAllSensors().then(r=>setSensors(r.sensors||[])).catch(()=>setSensors([]))]).finally(()=>setLoading(false))},[])
  const grouped=useMemo(()=>users.reduce((m,u)=>{(m[u.role||'Senza ruolo'] ||= []).push(u);return m},{}),[users])
  const toggleSensor=async(sensor,hotelId)=>{const flags={hotelgio:!!sensor.mostra_hotelgio,chocohotel:!!sensor.mostra_chocohotel,brigantino:!!sensor.mostra_brigantino};flags[hotelId]=!flags[hotelId];setSensors(list=>list.map(s=>s.device_id===sensor.device_id?{...s,[`mostra_${hotelId}`]:flags[hotelId]}:s));await updateSensorVisibility(sensor.device_id,flags)}
  return <div className="clean-app clean-settings"><header className="clean-settings-head"><div><span>⚙</span><div><b>Setting</b><small>RandApp Manutenzione</small></div></div><button onClick={onExit}>Esci</button></header><main className="clean-content">{loading?<Placeholder title="Caricamento"/>:tab==='users'?<section className="clean-settings-view"><div className="clean-title-row"><div><h1>Utenti</h1><p>Gestisci utenti, ruoli e accessi alle strutture.</p></div><button className="clean-add">+</button></div>{Object.entries(grouped).map(([role,list])=><section className="clean-role-group" key={role}><header><b>{role}</b><span>{list.length}</span></header>{list.map(u=><article key={u.auth_user_id||u.id||u.name}><div className="clean-user-top"><strong>{u.name}</strong><small>{u.department||''}</small></div><select value={u.role||''} readOnly><option>{u.role||'Senza ruolo'}</option></select><div className="clean-hotel-toggles">{HOTELS.map(h=><div key={h.id}><small>{h.short}</small><span className={(u.hotels||[]).includes(h.id)?'on':''}>{(u.hotels||[]).includes(h.id)?'✓':'—'}</span></div>)}</div><div className="clean-actions"><button>Modifica</button><button>PIN</button></div></article>)}</section>)}</section>:tab==='sensors'?<section className="clean-settings-view"><div className="clean-title-row"><div><h1>Sensori</h1><p>Visibilità per struttura.</p></div></div><div className="clean-sensor-list">{sensors.map(s=><article key={s.device_id}><div><strong>{s.nome||s.device_id}</strong><small>{s.temperatura!=null?`${s.temperatura}°C`:'—'}</small></div><div className="clean-sensor-hotels">{HOTELS.map(h=><button key={h.id} className={s[`mostra_${h.id}`]?'on':''} onClick={()=>toggleSensor(s,h.id)}><small>{h.short}</small><span>{s[`mostra_${h.id}`]?'✓':'—'}</span></button>)}</div></article>)}</div></section>:<section className="clean-settings-view"><div className="clean-title-row"><div><h1>Ruoli & Permessi</h1><p>Configura cosa compare sotto, nel laterale o viene disattivato.</p></div></div>{['Home','Segnalazioni','Interventi','Planning lavori','Planning Sale','Housekeeping','Sensori','Avvisi urgenti'].map((x,i)=><article className="clean-permission-row" key={x}><b>{x}</b><div>{['Sotto','Laterale','Off'].map((v,j)=><button key={v} className={(i<4&&j===0)||(i>=4&&j===1)?'active':''}>{v}</button>)}</div></article>)}</section>}</main><nav className="clean-settings-nav"><button className={tab==='users'?'active':''} onClick={()=>setTab('users')}><span>♙</span><small>Utenti</small></button><button className={tab==='sensors'?'active':''} onClick={()=>setTab('sensors')}><span>⌁</span><small>Sensori</small></button><button className={tab==='permissions'?'active':''} onClick={()=>setTab('permissions')}><span>☷</span><small>Permessi</small></button><button onClick={onExit}><span>⌂</span><small>RandApp</small></button></nav></div>
}

export default function AppClean(){const [session,setSession]=useState(loadSession());return session?<MainApp onSessionEnd={()=>setSession(null)}/>:<Login onLogged={()=>setSession(loadSession())}/>}
