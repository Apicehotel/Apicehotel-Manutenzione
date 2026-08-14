import { useEffect, useMemo, useRef, useState } from 'react'
import { DEPARTMENTS, HOTELS, ROLE_PERMISSIONS, ROLES, USERS } from './config.js'
import { clearSession, loadSession, saveSession } from './session.js'
import { isSupabaseConfigured } from './supabase.js'
import { HOTEL_LOCATIONS } from './locations.js'

const seededIssues = [
  { id: 1, hotelId: 'hotelgio', urgency: 'alta', room: '101 · Bagno', title: "Perdita d’acqua dal lavabo", status: 'todo', date: 'Oggi, 09:15', department: 'Governante', category: 'Idraulica', origin: 'App' },
  { id: 2, hotelId: 'hotelgio', urgency: 'media', room: '205 · Camera', title: 'Aria condizionata non raffredda', status: 'tecnico', date: 'Oggi, 10:30', department: 'Reception', category: 'Climatizzazione', origin: 'App' },
  { id: 3, hotelId: 'hotelgio', urgency: 'bassa', room: '301 · Balcone', title: 'Lampada esterna non funziona', status: 'attesa_pezzo', pieceName: 'Faretto LED esterno IP65', date: 'Ieri, 16:45', department: 'Governante', category: 'Elettrica', origin: 'App' },
  { id: 4, hotelId: 'chocohotel', urgency: 'alta', room: 'Sala Colazione', title: 'Frigo buffet non raffredda', status: 'todo', date: 'Oggi, 08:20', department: 'Isola dei Golosi', category: 'Attrezzature', origin: 'App' },
  { id: 5, hotelId: 'brigantino', urgency: 'media', room: '204 · Camera', title: 'Cassaforte bloccata', status: 'completata', completionNote: 'Sbloccata, batteria sostituita.', date: 'Ieri, 18:10', department: 'Reception', category: 'Camera', origin: 'App' },
]

const ISSUES_STORAGE_KEY = 'apicehotel.issues.v1'
const ISSUE_CATEGORIES = ['Idraulico', 'Elettrico', 'Climatizzazione', 'Arredo', 'Edilizio', 'Giardinaggio', 'Pulizia filtri', 'Idromassaggio', 'Extra Piani', 'Varie']
const ROOM_STATUS_OPTIONS = [['fermata_libera','Fermata libera'],['fermata_cliente','Fermata con cliente'],['libera','Libera'],['in_arrivo','In arrivo']]
const loadIssues = () => {
  try { const value = JSON.parse(localStorage.getItem(ISSUES_STORAGE_KEY)); return Array.isArray(value) ? value : seededIssues } catch { return seededIssues }
}
const USERS_STORAGE_KEY = 'apicehotel.users.v1'
const ALL_HOTELS_MIGRATION_KEY = 'apicehotel.all-hotels-migration.v1'
const ALL_HOTEL_IDS = HOTELS.map((hotel) => hotel.id)
const ADMIN_PIN_STORAGE_KEY = 'apicehotel.admin-pin.v1'
const DEFAULT_ADMIN_PIN = '000000'
const PERMISSION_LABELS = {
  manage_users: 'Gestione utenti', manage_all_hotels: 'Tutte le strutture', create: 'Crea segnalazioni', assign: 'Assegna lavori', complete: 'Completa lavori', read_all_departments: 'Tutti i reparti', planning_sale: 'Planning Sale', take_charge: 'Presa in carico', read_own_hotel: 'Lettura struttura'
}
function loadUsers() {
  try {
    const value = JSON.parse(localStorage.getItem(USERS_STORAGE_KEY))
    let users = (Array.isArray(value) && value.length ? value : USERS).map((user) => user.role === 'responsabile' ? { ...user, role: 'Responsabile' } : user)
    if (localStorage.getItem(ALL_HOTELS_MIGRATION_KEY) !== 'done') {
      users = users.map((user) => ({ ...user, hotels: [...ALL_HOTEL_IDS] }))
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users))
      localStorage.setItem(ALL_HOTELS_MIGRATION_KEY, 'done')
    }
    return users
  } catch { return USERS }
}

const Icon = ({ name }) => {
  const paths = {
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    arrow: <path d="m9 18 6-6-6-6"/>,
    logout: <><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M21 19V5a2 2 0 0 0-2-2h-6"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    tool: <path d="M14.7 6.3a4 4 0 0 0-5-5L12 3.6 9.6 6 7.3 3.7a4 4 0 0 0 5 5l-8.9 8.9a2.1 2.1 0 0 0 3 3l8.9-8.9a4 4 0 0 0-.6-5.4Z"/>,
    camera: <><path d="M14.5 4 16 7h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3l1.5-3Z"/><circle cx="12" cy="13" r="3"/></>,
    image: <><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 15-5-5L5 20"/></>,
  }
  return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function HotelMark({ hotel, large = false }) {
  return <span className={`hotel-mark ${hotel.tone} ${large ? 'large' : ''}`}>{hotel.mark}</span>
}

function Home({ onSelect, onAdmin }) {
  const sliderRef = useRef(null)
  const cardRefs = useRef([])
  const [activeIndex, setActiveIndex] = useState(1)
  const orderedHotels = ['chocohotel', 'hotelgio', 'brigantino']
    .map((id) => HOTELS.find((hotel) => hotel.id === id))

  const centerCard = (index, behavior = 'smooth') => {
    cardRefs.current[index]?.scrollIntoView({ behavior, inline: 'center', block: 'nearest' })
    setActiveIndex(index)
  }

  useEffect(() => {
    if (window.matchMedia('(max-width: 700px)').matches) {
      const timer = window.setTimeout(() => centerCard(1, 'auto'), 50)
      return () => window.clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    const slider = sliderRef.current
    if (!slider) return undefined
    let timer
    const onScroll = () => {
      if (!window.matchMedia('(max-width: 700px)').matches) return
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        const sliderRect = slider.getBoundingClientRect()
        const center = sliderRect.left + sliderRect.width / 2
        const closest = cardRefs.current.reduce((best, card, index) => {
          if (!card) return best
          const rect = card.getBoundingClientRect()
          const distance = Math.abs(center - (rect.left + rect.width / 2))
          return distance < best.distance ? { index, distance } : best
        }, { index: 1, distance: Number.POSITIVE_INFINITY })
        setActiveIndex(closest.index)
      }, 80)
    }
    slider.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      slider.removeEventListener('scroll', onScroll)
      window.clearTimeout(timer)
    }
  }, [])

  return (
    <div className="page home-page">
      <header className="home-header">
        <div className="home-brand"><Icon name="tool" /><strong>APICEHOTEL</strong></div>
        <button className="home-admin" onClick={onAdmin}><Icon name="user" /> Admin</button>
      </header>
      <main className="home-content">
        <section className="home-intro">
          <h1>Seleziona una struttura</h1>
          <p>Scegli la struttura per accedere all’area riservata</p>
        </section>
        <section className="hotel-slider" ref={sliderRef} aria-label="Seleziona una struttura">
          {orderedHotels.map((hotel, index) => (
            <button
              className={`showcase-card ${hotel.id} ${activeIndex === index ? 'active' : ''}`}
              key={hotel.id}
              ref={(node) => { cardRefs.current[index] = node }}
              onClick={() => onSelect(hotel)}
              type="button"
            >
              <img className="hotel-card-img" src={hotel.card} alt={hotel.name} />
            </button>
          ))}
        </section>
        <div className="slider-dots" aria-label="Navigazione strutture">
          {orderedHotels.map((hotel, index) => (
            <button key={hotel.id} className={`dot ${activeIndex === index ? 'active' : ''}`} onClick={() => centerCard(index)} aria-label={`Mostra ${hotel.name}`} aria-current={activeIndex === index ? 'true' : undefined} />
          ))}
        </div>
        <p className="mobile-help">Scorri per scegliere la struttura<br />e accedi con le tue credenziali</p>
      </main>
    </div>
  )
}

function HotelArtwork({ hotel, className = '' }) {
  return <span className={`hotel-artwork ${hotel.id} ${className}`}><img className="hotel-card-img" src={hotel.card} alt={`Logo ${hotel.name}`} /></span>
}

function Login({ hotel, users, onBack, onLogin }) {
  const allowed = users.filter((user) => user.hotels.includes(hotel.id))
  const suggestRef = useRef(null)
  const [query, setQuery] = useState('')
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [matchedUser, setMatchedUser] = useState(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const onClickOutside = (event) => {
      if (suggestRef.current && !suggestRef.current.contains(event.target)) setSuggestOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const trimmedQuery = query.trim().toLowerCase()
  const suggestions = trimmedQuery && !matchedUser
    ? allowed.filter((user) => user.name.toLowerCase().includes(trimmedQuery)).slice(0, 6)
    : []

  const pickUser = (user) => {
    setMatchedUser(user); setQuery(user.name); setSuggestOpen(false); setError('')
  }
  const onQueryChange = (value) => {
    setQuery(value); setSuggestOpen(true)
    if (matchedUser && value !== matchedUser.name) setMatchedUser(null)
  }

  const submit = (event) => {
    event.preventDefault()
    if (!matchedUser || pin.length !== 4 || matchedUser.pin !== pin) {
      setError('Utente o PIN non validi')
      return
    }
    onLogin(matchedUser)
  }

  return (
    <div className="page login-page">
      <button className="back-link" onClick={onBack}>‹ Cambia struttura</button>
      <main className="login-panel">
        <HotelArtwork hotel={hotel} className="login-hotel-art" />
        <h1>{hotel.name}</h1>
        <form onSubmit={submit}>
          <label>Il tuo nome
            <div className="location-autocomplete" ref={suggestRef}>
              <input
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                onFocus={() => setSuggestOpen(true)}
                placeholder="Scrivi il tuo nome"
                autoComplete="off"
              />
              {suggestOpen && suggestions.length > 0 && (
                <div className="location-suggestions">
                  {suggestions.map((user) => (
                    <button key={user.id} type="button" onClick={() => pickUser(user)}>{user.name} <small style={{ opacity: .6 }}>· {user.role}</small></button>
                  ))}
                </div>
              )}
              {suggestOpen && trimmedQuery && suggestions.length === 0 && (
                <div className="location-suggestions"><span style={{ display: 'block', padding: '10px 13px', color: '#8a8a85' }}>Nessun utente trovato</span></div>
              )}
            </div>
          </label>
          <label>PIN di 4 cifre
            <input inputMode="numeric" autoComplete="current-password" maxLength="4" pattern="[0-9]{4}" value={pin} onChange={(event) => { setPin(event.target.value.replace(/\D/g, '').slice(0, 4)); setError('') }} placeholder="••••" disabled={!matchedUser} />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="primary" disabled={!matchedUser || pin.length !== 4}>Accedi</button>
        </form>
        <aside className="session-note"><strong>Sessione persistente</strong><span>Il PIN non verrà richiesto di nuovo fino a logout, cambio utente o revoca.</span></aside>
      </main>
    </div>
  )
}

function AdminGate({ onBack, onSuccess }) {
  const [pin, setPin] = useState(''), [error, setError] = useState('')
  const submit = (event) => {
    event.preventDefault()
    if (pin !== (localStorage.getItem(ADMIN_PIN_STORAGE_KEY) || DEFAULT_ADMIN_PIN)) return setError('PIN Admin non valido')
    onSuccess()
  }
  return <div className="page login-page admin-gate-page">
    <button className="back-link" onClick={onBack}>‹ Torna alla scelta struttura</button>
    <main className="login-panel admin-gate">
      <span className="admin-lock"><Icon name="user" /></span><h1>Accesso Admin</h1><p>Inserisci il PIN amministratore di 6 cifre.</p>
      <form onSubmit={submit}><label>PIN Admin<input aria-label="PIN Admin" inputMode="numeric" autoComplete="current-password" maxLength="6" pattern="[0-9]{6}" value={pin} onChange={(e)=>{setPin(e.target.value.replace(/\D/g,'').slice(0,6));setError('')}} placeholder="••••••" /></label>{error&&<p className="error" role="alert">{error}</p>}<button className="primary" disabled={pin.length!==6}>Accedi al pannello</button></form>
    </main>
  </div>
}

function AdminPanel({ users, onUsersChange, onClose }) {
  const currentUser = users.find((item) => item.role === 'admin') || users[0]
  const [pinEditorOpen, setPinEditorOpen] = useState(false), [newAdminPin, setNewAdminPin] = useState('')
  const initial = { name: '', role: 'segnalatore', department: 'Reception', pin: '', hotels: [...ALL_HOTEL_IDS] }
  const [creating, setCreating] = useState(false), [message, setMessage] = useState(''), [draft, setDraft] = useState(initial)
  const commit = (next, text) => { onUsersChange(next); setMessage(text) }
  const update = (id, changes) => commit(users.map((item) => item.id === id ? { ...item, ...changes } : item), 'Modifiche salvate su questo dispositivo')
  const toggleHotel = (target, hotelId) => {
    if (target.hotels.includes(hotelId) && target.hotels.length === 1) return setMessage('Ogni utente deve mantenere almeno una struttura')
    update(target.id, { hotels: target.hotels.includes(hotelId) ? target.hotels.filter((id) => id !== hotelId) : [...target.hotels, hotelId] })
  }
  const create = (event) => {
    event.preventDefault()
    if (!draft.name.trim() || !/^\d{4}$/.test(draft.pin) || !draft.hotels.length) return setMessage('Inserisci nome, PIN di 4 cifre e almeno una struttura')
    const id = `${draft.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now()}`
    const next = { id, name: draft.name.trim(), role: draft.role, pin: draft.pin, hotels: draft.hotels, ...(draft.role === 'segnalatore' ? { department: draft.department } : {}) }
    commit([...users, next], `${next.name} aggiunto`); setDraft(initial); setCreating(false)
  }
  const remove = (target) => {
    if (target.id === currentUser.id) return setMessage('Deve rimanere almeno un amministratore principale')
    if (window.confirm(`Eliminare ${target.name}?`)) commit(users.filter((item) => item.id !== target.id), `${target.name} eliminato`)
  }
  const saveAdminPin = (event) => {
    event.preventDefault()
    if (!/^\d{6}$/.test(newAdminPin)) return setMessage('Il PIN Admin deve contenere esattamente 6 cifre')
    localStorage.setItem(ADMIN_PIN_STORAGE_KEY, newAdminPin); setNewAdminPin(''); setPinEditorOpen(false); setMessage('PIN Admin aggiornato')
  }
  return <section className="admin-panel">
    <div className="admin-heading"><div><button className="back-link" onClick={onClose}>‹ Torna alla Home</button><h1>Pannello admin</h1><p>Gestisci utenti, ruoli e accessi alle strutture.</p></div><div className="admin-actions"><button className="secondary change-pin" onClick={() => setPinEditorOpen(!pinEditorOpen)}>Cambia PIN Admin</button><button className="primary add-user" onClick={() => setCreating(!creating)}>{creating ? 'Annulla' : '+ Nuovo utente'}</button></div></div>
    {pinEditorOpen && <form className="admin-pin-form" onSubmit={saveAdminPin}><label>Nuovo PIN Admin di 6 cifre<input aria-label="Nuovo PIN Admin" inputMode="numeric" maxLength="6" value={newAdminPin} onChange={(e)=>setNewAdminPin(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="••••••" /></label><button className="primary" disabled={newAdminPin.length!==6}>Salva nuovo PIN</button></form>}
    {creating && <form className="user-form" onSubmit={create}>
      <label>Nome<input value={draft.name} onChange={(e) => setDraft({...draft,name:e.target.value})} placeholder="Nome utente" /></label>
      <label>Ruolo<select value={draft.role} onChange={(e) => setDraft({...draft,role:e.target.value})}>{ROLES.map((role)=><option key={role}>{role}</option>)}</select></label>
      {draft.role === 'segnalatore' && <label>Reparto<select value={draft.department} onChange={(e)=>setDraft({...draft,department:e.target.value})}>{DEPARTMENTS.map((item)=><option key={item}>{item}</option>)}</select></label>}
      <label>PIN di 4 cifre<input inputMode="numeric" maxLength="4" value={draft.pin} onChange={(e)=>setDraft({...draft,pin:e.target.value.replace(/\D/g,'').slice(0,4)})} placeholder="0000" /></label>
      <fieldset><legend>Strutture abilitate</legend>{HOTELS.map((hotel)=><label className="hotel-check" key={hotel.id}><input type="checkbox" checked={draft.hotels.includes(hotel.id)} onChange={()=>setDraft({...draft,hotels:draft.hotels.includes(hotel.id)?draft.hotels.filter((id)=>id!==hotel.id):[...draft.hotels,hotel.id]})}/>{hotel.name}</label>)}</fieldset>
      <button className="primary">Salva utente</button>
    </form>}
    {message && <p className="admin-message" role="status">{message}</p>}
    <section className="permission-matrix" aria-label="Permessi per ruolo"><h2>Ruoli e permessi</h2><div>{ROLES.map((role) => <article key={role}><strong>{role}</strong><span>{(ROLE_PERMISSIONS[role] || []).map((permission) => PERMISSION_LABELS[permission] || permission).join(' · ')}</span></article>)}</div><p>Il ruolo Direttore Centro Congressi è assegnabile in tutte le strutture. Planning Sale è riservato ad Admin e Direttore Centro Congressi presso Hotel Giò.</p></section>
    <div className="table-wrap"><table><thead><tr><th>Utente</th><th>Ruolo</th><th>Reparto</th>{HOTELS.map((hotel)=><th key={hotel.id}>{hotel.short}</th>)}<th /></tr></thead><tbody>{users.map((target)=><tr key={target.id}>
      <td><strong>{target.name}</strong>{target.id===currentUser.id&&<small>Accesso attuale</small>}</td>
      <td><select aria-label={`Ruolo di ${target.name}`} value={target.role} onChange={(e)=>update(target.id,{role:e.target.value})}>{ROLES.map((role)=><option key={role}>{role}</option>)}</select></td>
      <td>{target.role==='segnalatore'?<select aria-label={`Reparto di ${target.name}`} value={target.department||DEPARTMENTS[0]} onChange={(e)=>update(target.id,{department:e.target.value})}>{DEPARTMENTS.map((item)=><option key={item}>{item}</option>)}</select>:<span>—</span>}</td>
      {HOTELS.map((hotel)=><td key={hotel.id}><input type="checkbox" checked={target.hotels.includes(hotel.id)} onChange={()=>toggleHotel(target,hotel.id)} aria-label={`${target.name}: ${hotel.name}`}/></td>)}
      <td><button className="delete-user" onClick={()=>remove(target)} disabled={target.id===currentUser.id}>Elimina</button></td>
    </tr>)}</tbody></table></div>
    <p className="admin-footnote">Le modifiche sono operative e persistenti su questo dispositivo. Il collegamento definitivo dei profili a Supabase sarà il prossimo passaggio.</p>
  </section>
}

function LocationAutocomplete({ catalog, mode, onModeChange, value, onChange }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const rooms = useMemo(() => catalog.roomGroups.flatMap((group) => group.rooms), [catalog])
  const query = value.trim().toLowerCase()
  const suggestions = query ? (mode === 'camera'
    ? rooms.filter((room) => room.toLowerCase().startsWith(query))
    : catalog.zones.filter((zone) => [zone.name, ...zone.aliases].some((item) => item.toLowerCase().includes(query))).map((zone) => zone.name)
  ).slice(0, 8) : []
  useEffect(() => {
    const close = (event) => { if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [])
  const changeMode = (nextMode) => { onModeChange(nextMode); onChange(''); setOpen(false) }
  return <div className="location-autocomplete" ref={wrapRef}>
    <div className="location-modes">{[['camera','Camera'],['zona','Zona']].map(([key,label])=><button type="button" key={key} className={mode === key ? 'active' : ''} onClick={()=>changeMode(key)}>{label}</button>)}</div>
    <input aria-label={mode === 'camera' ? 'Numero camera' : 'Cerca zona'} inputMode={mode === 'camera' ? 'numeric' : 'text'} pattern={mode === 'camera' ? '[0-9]*' : undefined} autoComplete="off" value={value} placeholder={mode === 'camera' ? 'Numero camera, es. 214' : 'Cerca zona, es. Hall'} onFocus={()=>setOpen(Boolean(query))} onChange={(event)=>{const next=mode === 'camera' ? event.target.value.replace(/[^0-9]/g,'') : event.target.value;onChange(next);setOpen(Boolean(next.trim()))}} />
    {open && suggestions.length > 0 && <div className="location-suggestions">{suggestions.map((item)=><button type="button" key={item} onClick={()=>{onChange(item);setOpen(false)}}>{item}</button>)}</div>}
  </div>
}

function readPhotoAsDataUrl(file) {
  return new Promise((resolve) => {
    if (!file) return resolve(null)
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(file)
  })
}

function NewIssueForm({ hotel, user, onCancel, onSave }) {
  const catalog = HOTEL_LOCATIONS[hotel.id]
  const [locationMode, setLocationMode] = useState('camera')
  const [draft, setDraft] = useState({ location: '', title: '', urgency: 'media', category: 'Varie', photoName: '', photoData: null, roomStatus: null })
  const [saving, setSaving] = useState(false)
  const validLocation = locationMode === 'camera'
    ? catalog.roomGroups.some((group) => group.rooms.includes(draft.location.trim()))
    : catalog.zones.some((zone) => zone.name === draft.location.trim())
  const pickPhoto = async (file) => {
    const photoData = await readPhotoAsDataUrl(file)
    setDraft((current) => ({ ...current, photoName: file?.name || '', photoData }))
  }
  const submit = async (event) => {
    event.preventDefault()
    if (!validLocation || !draft.title.trim()) return
    setSaving(true)
    onSave({ id: Date.now(), hotelId: hotel.id, urgency: draft.urgency, room: (locationMode === 'camera' ? 'Camera' : 'Zona') + ' · ' + draft.location.trim(), title: draft.title.trim(), status: 'todo', date: 'Oggi, ' + new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }), createdAt: Date.now(), createdBy: user.id, createdByName: user.name, department: user.department || user.role, category: draft.category, origin: 'App', photoName: draft.photoName, photoData: draft.photoData, roomStatus: locationMode === 'camera' ? draft.roomStatus : null })
  }
  return <form className="new-issue-form" onSubmit={submit}>
    <div className="form-heading"><button type="button" className="form-back" onClick={onCancel} aria-label="Torna indietro">‹</button><div><h2>Nuova segnalazione</h2><p>{hotel.name} · stato iniziale Da fare</p></div></div>
    <div className="issue-form-grid">
      <label className="location-field">Numero camera<LocationAutocomplete catalog={catalog} mode={locationMode} onModeChange={setLocationMode} value={draft.location} onChange={(location)=>setDraft({...draft,location})} />{draft.location && !validLocation && <small className="field-error">{locationMode === 'camera' ? 'Camera non presente nella struttura.' : 'Scegli una zona riconosciuta dai suggerimenti.'}</small>}</label>
      {locationMode === 'camera' && <fieldset className="choice-field room-status-field"><legend>Stato camera</legend><div className="room-status-choices">{ROOM_STATUS_OPTIONS.map(([key,label])=><button type="button" key={key} className={draft.roomStatus === key ? 'active' : ''} onClick={()=>setDraft({...draft,roomStatus:draft.roomStatus === key ? null : key})}>{label}</button>)}</div></fieldset>}
      <fieldset className="choice-field urgency-field"><legend>Urgenza</legend><div className="urgency-choices">{[['alta','Alta'],['media','Media'],['bassa','Bassa']].map(([key,label])=><button type="button" key={key} className={draft.urgency === key ? 'active ' + key : ''} onClick={()=>setDraft({...draft,urgency:key})}>{label}</button>)}</div></fieldset>
      <fieldset className="choice-field category-field"><legend>Categoria</legend><div className="category-choices">{ISSUE_CATEGORIES.map((item)=><button type="button" key={item} className={draft.category === item ? 'active' : ''} onClick={()=>setDraft({...draft,category:item})}>{item}</button>)}</div></fieldset>
      <label className="description-field">Descrizione del problema<textarea required rows="4" value={draft.title} onChange={(e)=>setDraft({...draft,title:e.target.value})} placeholder="Descrivi il problema in modo chiaro" /></label>
      <fieldset className="choice-field photo-field"><legend>Foto</legend><div className="photo-actions"><label className="photo-action camera-action"><input className="photo-input camera-input" type="file" accept="image/*" capture="environment" onChange={(e)=>pickPhoto(e.target.files?.[0])} /><Icon name="camera" /><strong>Scatta foto</strong></label><label className="photo-action gallery-action"><input className="photo-input gallery-input" type="file" accept="image/*" onChange={(e)=>pickPhoto(e.target.files?.[0])} /><Icon name="image" /><strong>Scegli dalla galleria</strong></label></div>{draft.photoData && <img className="photo-preview" src={draft.photoData} alt="Anteprima foto selezionata" />}{draft.photoName && <small className="photo-selected">Selezionata: {draft.photoName}</small>}</fieldset>
    </div>
    <div className="form-actions"><button type="button" className="secondary cancel-issue" onClick={onCancel}>Annulla</button><button className="primary submit-issue" disabled={!validLocation || !draft.title.trim() || saving}>＋ Invia segnalazione</button></div>
  </form>
}

function IssueDetail({ issue, permissions, currentUser, onClose, onUpdate, onDelete }) {
  const [noteDraft, setNoteDraft] = useState('')
  const [completionPhoto, setCompletionPhoto] = useState(null)
  const [completionPhotoName, setCompletionPhotoName] = useState('')
  const [pieceDraft, setPieceDraft] = useState('')
  const [askingComplete, setAskingComplete] = useState(false)
  const [askingPiece, setAskingPiece] = useState(false)

  const takeCharge = () => onUpdate(issue.id, { status: 'tecnico', assignedTo: currentUser.id, assignedToName: currentUser.name, assignedAt: Date.now() })
  const confirmComplete = () => { onUpdate(issue.id, { status: 'completata', completionNote: noteDraft.trim() || null, completionPhotoData: completionPhoto, completedBy: currentUser.name, completedAt: Date.now() }); onClose() }
  const pickCompletionPhoto = async (file) => {
    const data = await readPhotoAsDataUrl(file)
    setCompletionPhoto(data); setCompletionPhotoName(file?.name || '')
  }
  const confirmPiece = () => { if (!pieceDraft.trim()) return; onUpdate(issue.id, { status: 'attesa_pezzo', pieceName: pieceDraft.trim(), pieceWaitingSince: Date.now() }); onClose() }
  const pieceArrived = () => onUpdate(issue.id, { status: 'tecnico', pieceArrivedAt: Date.now() })
  const requestTechnician = () => onUpdate(issue.id, { technicianRequested: true, technicianRequestedAt: Date.now(), technicianRequestedBy: currentUser.name })
  const remove = () => { if (window.confirm('Eliminare questa segnalazione? L’azione non è reversibile.')) { onDelete(issue.id); onClose() } }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-head">
          <button className="back-link" onClick={onClose}>‹ Chiudi</button>
          <span className={`urgency badge-${issue.urgency}`}>{issue.urgency}</span>
        </div>
        <h2>{issue.room}</h2>
        <p className="detail-description">{issue.title}</p>
        <dl className="detail-meta">
          <div><dt>Reparto</dt><dd>{issue.department}</dd></div>
          <div><dt>Categoria</dt><dd>{issue.category}</dd></div>
          <div><dt>Segnalata</dt><dd>{issue.date}{issue.createdByName ? ` · ${issue.createdByName}` : ''}</dd></div>
          {issue.roomStatus && <div><dt>Stato camera</dt><dd>{ROOM_STATUS_OPTIONS.find(([key]) => key === issue.roomStatus)?.[1] || issue.roomStatus}</dd></div>}
        </dl>

        {issue.photoData && <img className="detail-photo" src={issue.photoData} alt={`Foto segnalazione: ${issue.title}`} />}

        {issue.status === 'tecnico' && issue.assignedToName && (
          <div className="status-note in-progress">In carico a <strong>{issue.assignedToName}</strong></div>
        )}
        {issue.status === 'attesa_pezzo' && (
          <div className="status-note waiting-piece">In attesa di: <strong>{issue.pieceName}</strong></div>
        )}
        {issue.technicianRequested && issue.status !== 'completata' && (
          <div className="status-note tech-requested">Tecnico esterno richiesto da <strong>{issue.technicianRequestedBy}</strong></div>
        )}
        {issue.status === 'completata' && (
          <div className="status-note done">
            Completata da <strong>{issue.completedBy}</strong>
            {issue.completionNote && <p>{issue.completionNote}</p>}
            {issue.completionPhotoData && <img className="detail-photo" src={issue.completionPhotoData} alt="Foto riparazione completata" />}
          </div>
        )}

        <div className="detail-actions">
          {issue.status === 'todo' && permissions.includes('take_charge') && (
            <button className="primary" onClick={takeCharge}>Prendi in carico</button>
          )}

          {issue.status === 'tecnico' && permissions.includes('complete') && !askingComplete && !askingPiece && (
            <>
              <p className="detail-actions-heading">Azioni</p>
              <button className="primary" onClick={() => setAskingComplete(true)}>Riparazione completata</button>
              <p className="detail-actions-heading">Non riesco a risolvere</p>
              <button className="secondary" onClick={() => setAskingPiece(true)}>Serve pezzo</button>
              <button className="secondary" onClick={requestTechnician} disabled={issue.technicianRequested}>{issue.technicianRequested ? 'Tecnico già richiesto' : 'Chiedi un tecnico'}</button>
            </>
          )}
          {askingComplete && (
            <div className="inline-form">
              <label>Foto (opzionale)
                <div className="photo-actions">
                  <label className="photo-action camera-action"><input className="photo-input camera-input" type="file" accept="image/*" capture="environment" onChange={(e) => pickCompletionPhoto(e.target.files?.[0])} /><Icon name="camera" /><strong>Scatta foto</strong></label>
                  <label className="photo-action gallery-action"><input className="photo-input gallery-input" type="file" accept="image/*" onChange={(e) => pickCompletionPhoto(e.target.files?.[0])} /><Icon name="image" /><strong>Galleria</strong></label>
                </div>
                {completionPhoto && <img className="photo-preview" src={completionPhoto} alt="Anteprima foto completamento" />}
                {completionPhotoName && <small className="photo-selected">Selezionata: {completionPhotoName}</small>}
              </label>
              <label>Note sul lavoro fatto (facoltative)<textarea rows="3" value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="Cosa è stato fatto" /></label>
              <div className="inline-form-actions"><button className="secondary" onClick={() => setAskingComplete(false)}>Annulla</button><button className="primary" onClick={confirmComplete}>Segna completata</button></div>
            </div>
          )}
          {askingPiece && (
            <div className="inline-form">
              <label>Nome del pezzo in attesa<input value={pieceDraft} onChange={(e) => setPieceDraft(e.target.value)} placeholder="Es. Faretto LED esterno IP65" /></label>
              <div className="inline-form-actions"><button className="secondary" onClick={() => setAskingPiece(false)}>Annulla</button><button className="primary" disabled={!pieceDraft.trim()} onClick={confirmPiece}>Conferma attesa pezzo</button></div>
            </div>
          )}

          {issue.status === 'attesa_pezzo' && permissions.includes('complete') && (
            <button className="primary" onClick={pieceArrived}>Pezzo arrivato, riprendi lavorazione</button>
          )}

          {permissions.includes('assign') && (
            <button className="delete-user" onClick={remove}>Elimina segnalazione</button>
          )}
        </div>
      </div>
    </div>
  )
}

function Operations({ hotel, user, onLogout, onChangeHotel }) {
  const [tab, setTab] = useState('Segnalazioni')
  const [status, setStatus] = useState('todo')
  const [presence, setPresence] = useState(true)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('urgenza')
  const [advanced, setAdvanced] = useState(false)
  const [department, setDepartment] = useState('')
  const [category, setCategory] = useState('')
  const [creatingIssue, setCreatingIssue] = useState(false)
  const [openIssueId, setOpenIssueId] = useState(null)
  const [allIssues, setAllIssues] = useState(loadIssues)
  const persist = (next) => { localStorage.setItem(ISSUES_STORAGE_KEY, JSON.stringify(next)); setAllIssues(next) }
  const saveIssue = (issue) => {
    persist([...allIssues, issue]); setStatus('todo'); setTab('Segnalazioni'); setCreatingIssue(false)
  }
  const updateIssue = (id, changes) => persist(allIssues.map((item) => item.id === id ? { ...item, ...changes } : item))
  const deleteIssue = (id) => persist(allIssues.filter((item) => item.id !== id))
  const openIssue = allIssues.find((item) => item.id === openIssueId) || null

  const permissions = ROLE_PERMISSIONS[user.role] || []
  const tabs = ['Segnalazioni', 'Avvisi Urgenti', 'Interventi', ...(hotel.id === 'hotelgio' && permissions.includes('planning_sale') ? ['Planning Sale'] : [])]
  const hotelIssues = useMemo(() => allIssues.filter((issue) => issue.hotelId === hotel.id), [allIssues, hotel.id])
  const statusCounts = useMemo(() => hotelIssues.reduce((acc, issue) => ({ ...acc, [issue.status]: (acc[issue.status] || 0) + 1 }), {}), [hotelIssues])
  const issues = useMemo(() => allIssues
    .filter((issue) => issue.hotelId === hotel.id && issue.status === status)
    .filter((issue) => !query || `${issue.room} ${issue.title}`.toLowerCase().includes(query.toLowerCase()))
    .filter((issue) => !department || issue.department === department)
    .filter((issue) => !category || issue.category === category)
    .sort((a, b) => {
      if (sort === 'camera') return a.room.localeCompare(b.room, 'it', { numeric: true })
      if (sort === 'data') return b.id - a.id
      const weight = { alta: 3, media: 2, bassa: 1 }
      return weight[b.urgency] - weight[a.urgency] || a.id - b.id
    }), [allIssues, hotel.id, status, query, sort, department, category])

  return (
    <div className="operations">
      <header className="ops-header">
        <button className="hotel-switch" onClick={onChangeHotel}><HotelMark hotel={hotel} /><span><strong>{hotel.name}</strong><small>{user.name} · {user.role}</small></span></button>
        <button className={`presence ${presence ? 'on' : ''}`} onClick={() => setPresence(!presence)}><span /> Sono in struttura</button>
        <button className="icon-button" onClick={onLogout} title="Logout"><Icon name="logout" /></button>
      </header>
      <main className="ops-main">
        <div className="title-row"><div><h1>{tab}</h1><p>{isSupabaseConfigured ? 'Connesso a Supabase' : 'Dati locali · sincronizzazione Supabase da configurare'}</p></div><span className="role-chip">{permissions.length} permessi</span></div>
        <nav className="tabs">{tabs.map((item) => <button className={tab === item ? 'active' : ''} key={item} onClick={() => setTab(item)}>{item}</button>)}</nav>
        {tab === 'Segnalazioni' ? <>
          {creatingIssue && <NewIssueForm hotel={hotel} user={user} onCancel={()=>setCreatingIssue(false)} onSave={saveIssue} />}
          {openIssue && <IssueDetail issue={openIssue} permissions={permissions} currentUser={user} onClose={() => setOpenIssueId(null)} onUpdate={updateIssue} onDelete={deleteIssue} />}
          <div className="status-tabs">{[['todo','Da fare'],['tecnico','Tecnico'],['attesa_pezzo','Attesa pezzo'],['completata','Completate']].map(([key,label]) => <button className={status === key ? 'active' : ''} key={key} onClick={() => setStatus(key)}>{label} <span className="status-count">{statusCounts[key] || 0}</span></button>)}</div>
          <div className="toolbar"><label className="search"><Icon name="search"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cerca camera, zona o problema" /></label><select aria-label="Ordinamento" value={sort} onChange={(event) => setSort(event.target.value)}><option value="urgenza">Urgenza</option><option value="camera">Camera/Zona</option><option value="data">Data</option></select><button className="secondary" onClick={() => setAdvanced(!advanced)}>Filtri</button></div>
          {advanced && <div className="advanced-filters"><select value={department} onChange={(event) => setDepartment(event.target.value)}><option value="">Tutti i reparti</option><option>Governante</option><option>Reception</option><option>Isola dei Golosi</option></select><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">Tutte le categorie</option><option>Idraulica</option><option>Elettrica</option><option>Climatizzazione</option></select><select disabled><option>Origine: tutte</option></select><input type="date" aria-label="Data" /></div>}
          <section className="issue-list" aria-live="polite">{issues.length ? issues.map((issue) => <article className={`issue ${issue.urgency}`} key={issue.id} onClick={() => setOpenIssueId(issue.id)} role="button" tabIndex={0} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setOpenIssueId(issue.id)}><span className="urgency">{issue.urgency}</span><div><h3>{issue.room}</h3><p>{issue.title}</p><small>{issue.department} · {issue.category} · {issue.date}{issue.photoData ? ' · Foto' : ''}{issue.status === 'attesa_pezzo' ? ` · In attesa: ${issue.pieceName}` : ''}{issue.status === 'tecnico' && issue.assignedToName ? ` · In carico a ${issue.assignedToName}` : ''}{issue.technicianRequested && issue.status !== 'completata' ? ' · Tecnico richiesto' : ''}</small></div><Icon name="arrow" /></article>) : <div className="empty"><strong>Nessuna segnalazione</strong><span>Non ci sono elementi con questi filtri.</span></div>}</section>
        </> : tab === 'Planning Sale' ? <div className="placeholder planning-placeholder"><h2>Planning Sale</h2><p>Calendario sale congressi predisposto. Sarà sviluppato nel prossimo blocco funzionale.</p><span>Accesso autorizzato: {user.role}</span></div> : <div className="placeholder"><h2>{tab}</h2><p>Sezione predisposta per la prossima fase.</p></div>}
      </main>
      {tab === 'Segnalazioni' && permissions.includes('create') && !creatingIssue && !openIssue && (
        <button className="fab-new-issue" onClick={() => setCreatingIssue(true)} aria-label="Nuova segnalazione">
          <span className="fab-plus">+</span> Nuova segnalazione
        </button>
      )}
    </div>
  )
}

export default function App() {
  const [users, setUsers] = useState(loadUsers)
  const [adminStage, setAdminStage] = useState(null)
  const [session, setSession] = useState(loadSession)
  const [selectedHotel, setSelectedHotel] = useState(() => HOTELS.find((hotel) => hotel.id === session?.hotelId) || null)
  const hotel = HOTELS.find((item) => item.id === session?.hotelId)
  const user = users.find((item) => item.id === session?.userId)
  const updateUsers = (next) => { localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(next)); setUsers(next) }

  const login = (nextUser) => {
    const next = { hotelId: selectedHotel.id, userId: nextUser.id, createdAt: Date.now() }
    saveSession(next)
    setSession(next)
  }
  const logout = () => { clearSession(); setSession(null); setSelectedHotel(null) }
  const changeHotel = () => { clearSession(); setSession(null); setSelectedHotel(null) }

  if (session && hotel && user && user.hotels.includes(hotel.id)) return <Operations hotel={hotel} user={user} onLogout={logout} onChangeHotel={changeHotel} />
  if (adminStage === 'panel') return <div className="operations"><main className="ops-main global-admin"><AdminPanel users={users} onUsersChange={updateUsers} onClose={() => setAdminStage(null)} /></main></div>
  if (adminStage === 'pin') return <AdminGate onBack={() => setAdminStage(null)} onSuccess={() => setAdminStage('panel')} />
  if (selectedHotel) return <Login hotel={selectedHotel} users={users} onBack={() => setSelectedHotel(null)} onLogin={login} />
  return <Home onSelect={setSelectedHotel} onAdmin={() => setAdminStage('pin')} />
}
