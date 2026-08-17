import { useEffect, useMemo, useRef, useState } from 'react'
import { DEPARTMENTS, HOTELS, ROLE_PERMISSIONS, ROLES, USERS } from './config.js'
import { clearSession, loadSession, saveSession } from './session.js'
import { isSupabaseConfigured } from './supabase.js'
import { loginWithPin, logoutPinSession, restorePinSession } from './pin-auth.js'
import { fetchIssues, createIssue, updateIssue as updateIssueRemote, deleteIssue as deleteIssueRemote } from './issues-api.js'
import { HOTEL_LOCATIONS } from './locations.js'
import { PlanningSale, PlanningWork } from './planning.jsx'
import { TemperatureSensors } from './temperature.jsx'
import { Housekeeping } from './housekeeping.jsx'

const seededIssues = [
  { id: 1, hotelId: 'hotelgio', urgency: 'alta', room: '101 · Bagno', title: "Perdita d’acqua dal lavabo", status: 'todo', date: 'Oggi, 09:15', department: 'Governante', category: 'Idraulica', origin: 'App' },
  { id: 2, hotelId: 'hotelgio', urgency: 'media', room: '205 · Camera', title: 'Aria condizionata non raffredda', status: 'tecnico', technicianRequestedBy: 'Reception', date: 'Oggi, 10:30', department: 'Reception', category: 'Climatizzazione', origin: 'App' },
  { id: 3, hotelId: 'hotelgio', urgency: 'bassa', room: '301 · Balcone', title: 'Lampada esterna non funziona', status: 'waiting', pieceName: 'Faretto LED esterno IP65', date: 'Ieri, 16:45', department: 'Governante', category: 'Elettrica', origin: 'App' },
  { id: 4, hotelId: 'chocohotel', urgency: 'alta', room: 'Sala Colazione', title: 'Frigo buffet non raffredda', status: 'todo', date: 'Oggi, 08:20', department: 'Isola dei Golosi', category: 'Attrezzature', origin: 'App' },
  { id: 5, hotelId: 'brigantino', urgency: 'media', room: '204 · Camera', title: 'Cassaforte bloccata', status: 'done', completionNote: 'Sbloccata, batteria sostituita.', date: 'Ieri, 18:10', department: 'Reception', category: 'Camera', origin: 'App' },
]

const ISSUES_STORAGE_KEY = 'apicehotel.issues.v1'
const UI_SIZE_STORAGE_KEY = 'apicehotel.ui-size.v1'
const PLANNED_STORAGE_KEY = 'apicehotel.planned.v1'
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
    clipboard: <><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 9h6M9 13h6"/></>,
    alert: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
    filter: <><path d="M4 6h16M7 12h10M10 18h4"/></>,
    chevron: <path d="m6 9 6 6 6-6"/>,
    package: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9Z"/><path d="m4.5 7.7 7.5 4.2 7.5-4.2M12 12v9"/></>,
    message: <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/>,
    check: <path d="m5 12 4 4L19 6"/>,
    menu: <path d="M4 6h16M4 12h16M4 18h16"/>,
    refresh: <><path d="M20 6v5h-5"/><path d="M4 18v-5h5"/><path d="M18.5 9A7 7 0 0 0 6 6.5L4 11M5.5 15A7 7 0 0 0 18 17.5l2-4.5"/></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4H6.5A2.5 2.5 0 0 0 4 6.5Z"/><path d="M4 6.5v13"/></>,
    download: <><path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/></>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
    hotel: <><path d="M4 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16"/><path d="M8 7h2M14 7h2M8 11h2M14 11h2M9 21v-5h6v5"/></>,
    temperature: <><path d="M14 14.8V5a4 4 0 0 0-8 0v9.8a6 6 0 1 0 8 0Z"/><path d="M10 9v8"/></>,
    housekeeping: <><path d="M4 5h16v16H4z"/><path d="M8 3v4M16 3v4M4 10h16M8 14h3M8 18h8"/></>,
  }
  return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}
const loadPlanned = () => {
  try { const value = JSON.parse(localStorage.getItem(PLANNED_STORAGE_KEY)); return Array.isArray(value) ? value : [] } catch { return [] }
}

const FEEDBACK_STORAGE_KEY = 'apicehotel.feedback.v1'
const URGENT_STORAGE_KEY = 'apicehotel.urgent.v1'
const URGENT_RETENTION_MS = 72 * 60 * 60 * 1000
const loadUrgents = () => {
  try {
    const value = JSON.parse(localStorage.getItem(URGENT_STORAGE_KEY))
    const items = Array.isArray(value) ? value.filter((item) => Date.now() - item.createdAt < URGENT_RETENTION_MS) : []
    localStorage.setItem(URGENT_STORAGE_KEY, JSON.stringify(items))
    return items
  } catch { return [] }
}
const persistUrgents = (items) => localStorage.setItem(URGENT_STORAGE_KEY, JSON.stringify(items))
const canSendUrgent = (user) => ['Direzione', 'Direttore Centro Congressi'].includes(user.role) || user.department === 'Reception'
const canManageUrgent = (user) => user.role === 'manutentore'
const canViewUrgent = (user) => canSendUrgent(user) || canManageUrgent(user)
function playUrgentSignal() {
  navigator.vibrate?.([250, 120, 250])
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return
    const context = new AudioContext()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(760, context.currentTime)
    oscillator.frequency.linearRampToValueAtTime(980, context.currentTime + .45)
    gain.gain.setValueAtTime(.08, context.currentTime); gain.gain.linearRampToValueAtTime(0, context.currentTime + .8)
    oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + .8)
    oscillator.onended = () => context.close()
  } catch { /* Il browser può bloccare l'audio fuori da un gesto utente. */ }
}
const csvCell = (value = '') => `"${String(value).replaceAll('"', '""')}"`
function exportIssuesCsv(issues, hotel) {
  const headers = ['Struttura', 'Camera o zona', 'Problema', 'Gravità', 'Stato', 'Reparto', 'Categoria', 'Data']
  const rows = issues.filter((issue) => issue.hotelId === hotel.id).map((issue) => [hotel.name, issue.room, issue.title, issue.urgency, issue.status, issue.department, issue.category, issue.date])
  const content = [headers, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n')
  const url = URL.createObjectURL(new Blob([`\ufeff${content}`], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `segnalazioni-${hotel.id}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

function MenuPanel({ type, user, onClose, onSavePin }) {
  const [pin, setPin] = useState('')
  const [feedback, setFeedback] = useState('')
  const [message, setMessage] = useState('')
  const savePin = (event) => {
    event.preventDefault()
    if (!/^\d{4}$/.test(pin)) return
    onSavePin(pin); setMessage('PIN aggiornato'); setPin('')
  }
  const saveFeedback = (event) => {
    event.preventDefault()
    const entries = JSON.parse(localStorage.getItem(FEEDBACK_STORAGE_KEY) || '[]')
    localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify([...entries, { text: feedback.trim(), userId: user.id, createdAt: Date.now() }]))
    setFeedback(''); setMessage('Feedback salvato su questo dispositivo')
  }
  const enableNotifications = async () => {
    if (!('Notification' in window)) return setMessage('Notifiche non supportate su questo dispositivo')
    const permission = await Notification.requestPermission()
    setMessage(permission === 'granted' ? 'Notifiche abilitate' : 'Permesso notifiche non concesso')
  }
  const titles = { pin: 'Cambia PIN', notifications: 'Notifiche', manual: 'Manuale', feedback: 'Feedback' }
  return <div className="menu-panel-backdrop" role="presentation" onClick={onClose}>
    <section className="menu-panel" role="dialog" aria-modal="true" aria-labelledby="menu-panel-title" onClick={(event) => event.stopPropagation()}>
      <header><h2 id="menu-panel-title">{titles[type]}</h2><button className="panel-close" onClick={onClose} aria-label="Chiudi"><Icon name="close" /></button></header>
      {type === 'pin' && <form onSubmit={savePin}><label>Nuovo PIN di 4 cifre<input aria-label="Nuovo PIN" inputMode="numeric" maxLength="4" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))} /></label><button className="primary" disabled={pin.length !== 4}>Salva PIN</button></form>}
      {type === 'notifications' && <div className="panel-content"><p>Ricevi gli aggiornamenti importanti della manutenzione sul dispositivo.</p><button className="primary" onClick={enableNotifications}>Abilita notifiche</button></div>}
      {type === 'manual' && <div className="manual-list"><article><strong>1. Segnalazioni</strong><span>Apri una richiesta, controlla camera, problema e gravità.</span></article><article><strong>2. Aggiorna lo stato</strong><span>Richiedi un tecnico o un pezzo quando il lavoro non può essere concluso.</span></article><article><strong>3. Completa</strong><span>Aggiungi foto e note prima di segnare la riparazione completata.</span></article></div>}
      {type === 'feedback' && <form onSubmit={saveFeedback}><label>Scrivi un suggerimento<textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} rows="5" /></label><button className="primary" disabled={!feedback.trim()}>Salva feedback</button></form>}
      {message && <p className="menu-panel-message" role="status">{message}</p>}
    </section>
  </div>
}

function UrgentSection({ hotel, user, items, openRequest, onItemsChange, onTake, onComplete, onTransform }) {
  const [filter, setFilter] = useState('tutte')
  const [creating, setCreating] = useState(false)
  const [note, setNote] = useState('')
  const canTake = canManageUrgent(user)
  useEffect(() => { if (openRequest) setCreating(true) }, [openRequest])
  const hotelItems = items.filter((item) => item.hotelId === hotel.id)
  const counts = hotelItems.reduce((acc, item) => ({ ...acc, [item.status]: (acc[item.status] || 0) + 1 }), {})
  const filtered = hotelItems.filter((item) => filter === 'tutte' || (filter === 'attesa' && item.status === 'aperta') || (filter === 'lavorazione' && item.status === 'presa_in_carico') || (filter === 'fatte' && item.status === 'completata'))
  const send = (event) => {
    event.preventDefault()
    const text = note.trim()
    if (!text) return
    onItemsChange([{ id: Date.now(), hotelId: hotel.id, note: text, status: 'aperta', createdBy: user.name, createdAt: Date.now() }, ...items])
    setNote(''); setCreating(false); setFilter('attesa')
  }
  const take = (id) => { onTake(id); setFilter('lavorazione') }
  const complete = (id) => { onComplete(id); setFilter('fatte') }
  const filters = [['tutte', 'Tutte', hotelItems.length], ['attesa', 'In attesa', counts.aperta || 0], ['lavorazione', 'In lavorazione', counts.presa_in_carico || 0], ['fatte', 'Fatte', counts.completata || 0]]
  return <section className="urgent-section">
    <div className="urgent-heading"><div><h2>Avvisi Urgenti</h2><p>Richieste immediate alla squadra manutenzione.</p></div></div>
    {creating && <form className="urgent-form" onSubmit={send}><label>Che cosa serve con urgenza?<textarea autoFocus rows="3" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Esempio: serve subito assistenza in camera 206" /></label><div><button type="button" className="secondary" onClick={() => { setCreating(false); setNote('') }}>Annulla</button><button className="urgent-send" disabled={!note.trim()}>Invia avviso urgente</button></div></form>}
    <div className="urgent-filters">{filters.map(([key, label, count]) => <button key={key} className={filter === key ? 'active' : key === 'attesa' && count ? 'attention' : ''} onClick={() => setFilter(key)}>{label} <span>{count}</span></button>)}</div>
    <div className="urgent-list">{filtered.length ? filtered.map((item) => {
      const working = item.status === 'presa_in_carico', done = item.status === 'completata'
      return <article className={`urgent-card ${done ? 'done' : working ? 'working' : 'open'}`} key={item.id}>
        <strong className="urgent-state">{done ? 'Gestita' : working ? 'In corso' : 'Richiesta urgente'}</strong>
        <small>Da {item.createdBy} · {new Date(item.createdAt).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</small>
        <p>{item.note}</p>
        {done ? <div className="urgent-result">{item.transformed ? 'Trasformata in segnalazione' : `Fatto da ${item.completedBy || item.takenBy}`}</div> : working ? <><div className="urgent-result">{item.takenBy} sta andando</div>{canTake && <button className="urgent-primary" onClick={() => complete(item.id)}>Fatto</button>}{canTake && <button className="urgent-secondary" onClick={() => onTransform(item)}>Non risolvibile — trasforma in segnalazione</button>}</> : canTake ? <><button className="urgent-primary" onClick={() => take(item.id)}>Vado</button><button className="urgent-secondary" onClick={() => onTransform(item)}>Non risolvibile — trasforma in segnalazione</button></> : <div className="urgent-result">In attesa che un manutentore la prenda in carico</div>}
      </article>
    }) : <div className="urgent-empty"><strong>Nessuna richiesta urgente</strong><span>Gli avvisi della struttura compariranno qui.</span></div>}</div>
  </section>
}

function UrgentBanner({ items, onOpen, onTake, onComplete, onTransform }) {
  if (!items.length) return null
  return <section className="urgent-banner" aria-live="assertive"><button className="urgent-banner-title" onClick={onOpen}>🚨 {items.length === 1 ? 'Avviso urgente' : `${items.length} avvisi urgenti`}</button>{items.slice(0, 2).map((item) => <article key={item.id}><div><strong>{item.note}</strong><small>{item.status === 'presa_in_carico' ? `${item.takenBy} sta andando` : `Da ${item.createdBy}`}</small></div><div>{item.status === 'aperta' ? <button onClick={() => onTake(item.id)}>Vado</button> : <button onClick={() => onComplete(item.id)}>Fatto</button>}<button onClick={() => onTransform(item)}>Trasforma</button></div></article>)}</section>
}

function UrgentTransformModal({ urgent, hotel, onClose, onSave }) {
  const catalog = HOTEL_LOCATIONS[hotel.id]
  const [mode, setMode] = useState('camera')
  const [draft, setDraft] = useState({ location: '', category: '', urgency: '', note: urgent.note })
  const validLocation = mode === 'camera' ? catalog.roomGroups.some((group) => group.rooms.includes(draft.location.trim())) : catalog.zones.some((zone) => zone.name === draft.location.trim())
  const valid = validLocation && draft.category && draft.urgency && draft.note.trim()
  return <div className="urgent-transform-backdrop" onClick={onClose}><form className="urgent-transform" role="dialog" aria-modal="true" aria-labelledby="urgent-transform-title" onClick={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); if (valid) onSave({ ...draft, mode }) }}>
    <header><div><h2 id="urgent-transform-title">Trasforma in segnalazione</h2><p>Completa i dati mancanti prima di inviare.</p></div><button type="button" className="panel-close" onClick={onClose} aria-label="Chiudi"><Icon name="close" /></button></header>
    <label>Camera o zona<LocationAutocomplete catalog={catalog} mode={mode} onModeChange={setMode} value={draft.location} onChange={(location) => setDraft({ ...draft, location })} />{draft.location && !validLocation && <small className="field-error">Scegli una posizione riconosciuta.</small>}</label>
    <fieldset className="choice-field"><legend>Categoria obbligatoria</legend><div className="category-choices">{ISSUE_CATEGORIES.map((item) => <button type="button" key={item} className={draft.category === item ? 'active' : ''} onClick={() => setDraft({ ...draft, category: item })}>{item}</button>)}</div></fieldset>
    <fieldset className="choice-field"><legend>Gravità obbligatoria</legend><div className="urgency-choices">{[['alta','Alta'],['media','Media'],['bassa','Bassa']].map(([key,label]) => <button type="button" key={key} className={draft.urgency === key ? `active ${key}` : ''} onClick={() => setDraft({ ...draft, urgency: key })}>{label}</button>)}</div></fieldset>
    <label>Note<textarea required rows="4" value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} /></label>
    <div className="form-actions"><button type="button" className="secondary" onClick={onClose}>Annulla</button><button className="primary" disabled={!valid}>Crea segnalazione</button></div>
  </form></div>
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
  const allowed = users.filter((user) => user.hotels?.includes(hotel.id))
  const suggestRef = useRef(null)
  const [query, setQuery] = useState('')
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const onClickOutside = (event) => {
      if (suggestRef.current && !suggestRef.current.contains(event.target)) setSuggestOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const trimmedQuery = query.trim().toLowerCase()
  const suggestions = trimmedQuery
    ? allowed.filter((user) => user.name.toLowerCase().includes(trimmedQuery)).slice(0, 6)
    : []

  const pickUser = (user) => {
    setQuery(user.name); setSuggestOpen(false); setError('')
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!query.trim() || pin.length !== 4 || loading) {
      setError('Inserisci nome e PIN di 4 cifre')
      return
    }

    setLoading(true)
    setError('')

    try {
      const authenticatedUser = await loginWithPin({
        name: query,
        pin,
        hotelId: hotel.id,
      })

      await onLogin(authenticatedUser)
    } catch (authError) {
      setError(authError?.message || 'Accesso non riuscito')
    } finally {
      setLoading(false)
    }
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
                onChange={(event) => { setQuery(event.target.value); setSuggestOpen(true); setError('') }}
                onFocus={() => setSuggestOpen(true)}
                placeholder="Scrivi il tuo nome"
                autoComplete="username"
              />
              {suggestOpen && suggestions.length > 0 && (
                <div className="location-suggestions">
                  {suggestions.map((user) => (
                    <button key={user.id} type="button" onClick={() => pickUser(user)}>{user.name} <small style={{ opacity: .6 }}>· {user.role}</small></button>
                  ))}
                </div>
              )}
            </div>
          </label>
          <label>PIN di 4 cifre
            <input
              inputMode="numeric"
              autoComplete="current-password"
              maxLength="4"
              pattern="[0-9]{4}"
              value={pin}
              onChange={(event) => { setPin(event.target.value.replace(/\D/g, '').slice(0, 4)); setError('') }}
              placeholder="••••"
              disabled={!query.trim() || loading}
            />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="primary" disabled={!query.trim() || pin.length !== 4 || loading}>{loading ? 'Accesso…' : 'Accedi'}</button>
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
    <section className="permission-matrix" aria-label="Permessi per ruolo"><h2>Ruoli e permessi</h2><div>{ROLES.map((role) => <article key={role}><strong>{role}</strong><span>{(ROLE_PERMISSIONS[role] || []).map((permission) => PERMISSION_LABELS[permission] || permission).join(' · ')}</span></article>)}</div><p>Planning lavori e Planning Sale sono visibili nel menu solo a Manutentore e Direttore Centro Congressi. Planning Sale è disponibile solo presso Hotel Giò.</p></section>
    <div className="table-wrap"><table><thead><tr><th>Utente</th><th>Ruolo</th><th>Reparto</th>{HOTELS.map((hotel)=><th key={hotel.id}>{hotel.short}</th>)}<th /></tr></thead><tbody>{users.map((target)=><tr key={target.id}>
      <td className="admin-user-name"><strong>{target.name}</strong>{target.id===currentUser.id&&<small>Accesso attuale</small>}</td>
      <td data-label="Ruolo"><select aria-label={`Ruolo di ${target.name}`} value={target.role} onChange={(e)=>update(target.id,{role:e.target.value})}>{ROLES.map((role)=><option key={role}>{role}</option>)}</select></td>
      <td data-label="Reparto">{target.role==='segnalatore'?<select aria-label={`Reparto di ${target.name}`} value={target.department||DEPARTMENTS[0]} onChange={(e)=>update(target.id,{department:e.target.value})}>{DEPARTMENTS.map((item)=><option key={item}>{item}</option>)}</select>:<span>—</span>}</td>
      {HOTELS.map((hotel)=><td data-label={hotel.short} key={hotel.id}><input type="checkbox" checked={target.hotels.includes(hotel.id)} onChange={()=>toggleHotel(target,hotel.id)} aria-label={`${target.name}: ${hotel.name}`}/></td>)}
      <td className="admin-user-actions"><button className="delete-user" onClick={()=>remove(target)} disabled={target.id===currentUser.id}>Elimina</button></td>
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
    try {
      await onSave({ id: Date.now(), hotelId: hotel.id, urgency: draft.urgency, room: (locationMode === 'camera' ? 'Camera' : 'Zona') + ' · ' + draft.location.trim(), title: draft.title.trim(), status: 'todo', date: 'Oggi, ' + new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }), createdAt: Date.now(), createdBy: user.id, createdByName: user.name, department: user.department || user.role, category: draft.category, origin: 'App', photoName: draft.photoName, photoData: draft.photoData, roomStatus: locationMode === 'camera' ? draft.roomStatus : null })
    } finally {
      setSaving(false)
    }
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
  const [replacedDraft, setReplacedDraft] = useState('')
  const [askingPiece, setAskingPiece] = useState(false)
  const [askingReplaced, setAskingReplaced] = useState(false)
  const [photoPickerOpen, setPhotoPickerOpen] = useState(false)

  const canAct = issue.status === 'todo' && permissions.includes('complete')

  const confirmComplete = () => { onUpdate(issue.id, { status: 'done', completionNote: noteDraft.trim() || null, completionPhotoData: completionPhoto, completedBy: currentUser.name, completedAt: Date.now() }); onClose() }
  const pickCompletionPhoto = async (file) => {
    const data = await readPhotoAsDataUrl(file)
    setCompletionPhoto(data); setCompletionPhotoName(file?.name || ''); setPhotoPickerOpen(false)
  }
  const confirmPiece = () => { if (!pieceDraft.trim()) return; onUpdate(issue.id, { status: 'waiting', pieceName: pieceDraft.trim(), pieceWaitingSince: Date.now() }); onClose() }
  const pieceArrived = () => { onUpdate(issue.id, { status: 'todo', pieceArrivedAt: Date.now() }); onClose() }
  const savePieceDecision = (decision) => onUpdate(issue.id, { pieceDecision: decision, pieceDecisionBy: currentUser.name, pieceDecisionAt: Date.now() })
  const confirmReplaced = () => { if (!replacedDraft.trim()) return; onUpdate(issue.id, { pieceReplaced: replacedDraft.trim(), pieceReplacedBy: currentUser.name, pieceReplacedAt: Date.now() }); setAskingReplaced(false); setReplacedDraft('') }
  const requestTechnician = () => { onUpdate(issue.id, { status: 'tecnico', technicianRequestedAt: Date.now(), technicianRequestedBy: currentUser.name }); onClose() }
  const techDone = () => { onUpdate(issue.id, { status: 'done', completedBy: currentUser.name, completedAt: Date.now() }); onClose() }
  const remove = () => { if (window.confirm('Eliminare questa segnalazione? L’azione non è reversibile.')) { onDelete(issue.id); onClose() } }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-head">
          <button className="back-link" onClick={onClose}>‹ Chiudi</button>
          <div className="sheet-head-actions">
            {permissions.includes('assign') && (
              <button className="delete-issue-compact" onClick={remove}>Elimina</button>
            )}
            <span className={`urgency badge-${issue.urgency}`}>{issue.urgency}</span>
          </div>
        </div>
        <h2 className="detail-room">{issue.room}</h2>
        <section className="issue-summary">
          <p className="detail-section-label">Problema segnalato</p>
          <p className="detail-description">{issue.title}</p>
          <p className="detail-origin">Da {issue.origin || 'App'}{issue.createdByName ? ` · ${issue.createdByName}` : ''} · {issue.date}</p>
          <dl className="detail-meta">
            <div><dt>Reparto</dt><dd>{issue.department}</dd></div>
            <div><dt>Categoria</dt><dd>{issue.category}</dd></div>
            {issue.roomStatus && <div><dt>Stato camera</dt><dd>{ROOM_STATUS_OPTIONS.find(([key]) => key === issue.roomStatus)?.[1] || issue.roomStatus}</dd></div>}
          </dl>
        </section>

        {issue.photoData && <img className="detail-photo" src={issue.photoData} alt={`Foto segnalazione: ${issue.title}`} />}

        {issue.status === 'tecnico' && (
          <div className="status-note tech-requested">Tecnico esterno richiesto da <strong>{issue.technicianRequestedBy}</strong></div>
        )}
        {issue.status === 'waiting' && (
          <div className="status-note waiting-piece">
            In attesa di: <strong>{issue.pieceName}</strong>
            {!issue.pieceDecision ? (
              <div className="piece-decision-choices">
                <button type="button" onClick={() => savePieceDecision('ritiro')}>🚗 Lo vado a ritirare</button>
                <button type="button" onClick={() => savePieceDecision('ordine')}>📦 Verrà ordinato</button>
              </div>
            ) : (
              <p className="piece-decision-note">{issue.pieceDecision === 'ritiro' ? '🚗 Da ritirare di persona' : '📦 In ordine'} · {issue.pieceDecisionBy}</p>
            )}
          </div>
        )}
        {issue.pieceReplaced && (
          <div className="status-note piece-replaced">
            Pezzo sostituito: <strong>{issue.pieceReplaced}</strong>
            <p>Da {issue.pieceReplacedBy}</p>
          </div>
        )}
        {issue.status === 'done' && (
          <div className="status-note done">
            Completata da <strong>{issue.completedBy}</strong>
            {issue.completionNote && <p>{issue.completionNote}</p>}
            {issue.completionPhotoData && <img className="detail-photo" src={issue.completionPhotoData} alt="Foto riparazione completata" />}
          </div>
        )}

        <div className="detail-actions action-panel">
          {canAct && !askingPiece && !askingReplaced && (
            <>
              <p className="detail-actions-heading">Azioni</p>
              <div className="detail-action-pair">
                <button className="secondary action-needs-piece" onClick={() => setAskingPiece(true)}><Icon name="package" />Serve pezzo</button>
                {!issue.pieceReplaced && <button className="secondary action-replaced" onClick={() => setAskingReplaced(true)}><Icon name="package" />Pezzo sostituito</button>}
              </div>
              <button className="secondary action-technician" onClick={requestTechnician}><Icon name="message" />Chiedi un tecnico</button>
              <div className="completion-fields">
                <p className="completion-fields-title">Riparazione completata</p>
                <label>Foto (opzionale)
                  <button type="button" className="photo-picker-trigger" onClick={() => setPhotoPickerOpen(!photoPickerOpen)} aria-expanded={photoPickerOpen}><Icon name="camera" /><span>{completionPhotoName ? 'Cambia foto' : 'Aggiungi foto'}</span><Icon name="chevron" /></button>
                  {photoPickerOpen && <div className="photo-picker-options">
                    <label><input className="photo-input" type="file" accept="image/*" capture="environment" onChange={(e) => pickCompletionPhoto(e.target.files?.[0])} /><Icon name="camera" /><strong>Scatta foto</strong></label>
                    <label><input className="photo-input" type="file" accept="image/*" onChange={(e) => pickCompletionPhoto(e.target.files?.[0])} /><Icon name="image" /><strong>Scegli dalla galleria</strong></label>
                  </div>}
                  {completionPhoto && <img className="photo-preview" src={completionPhoto} alt="Anteprima foto completamento" />}
                  {completionPhotoName && <small className="photo-selected">Selezionata: {completionPhotoName}</small>}
                </label>
                <label>Note sul lavoro fatto (facoltative)<textarea rows="3" value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="Cosa è stato fatto" /></label>
              </div>
              <button className="primary complete-action" onClick={confirmComplete}><Icon name="check" />Riparazione completata</button>
            </>
          )}
          {issue.status === 'tecnico' && permissions.includes('complete') && (
            <button className="primary" onClick={techDone}>Segna completata (tecnico)</button>
          )}
          {askingReplaced && (
            <div className="inline-form">
              <label>Cosa hai sostituito<input value={replacedDraft} onChange={(e) => setReplacedDraft(e.target.value)} placeholder="Es. Lampadina LED bagno" /></label>
              <div className="inline-form-actions"><button className="secondary" onClick={() => setAskingReplaced(false)}>Annulla</button><button className="primary" disabled={!replacedDraft.trim()} onClick={confirmReplaced}>Registra sostituzione</button></div>
            </div>
          )}
          {askingPiece && (
            <div className="inline-form">
              <label>Nome del pezzo in attesa<input value={pieceDraft} onChange={(e) => setPieceDraft(e.target.value)} placeholder="Es. Faretto LED esterno IP65" /></label>
              <div className="inline-form-actions"><button className="secondary" onClick={() => setAskingPiece(false)}>Annulla</button><button className="primary" disabled={!pieceDraft.trim()} onClick={confirmPiece}>Conferma attesa pezzo</button></div>
            </div>
          )}

          {issue.status === 'waiting' && permissions.includes('complete') && (
            <button className="primary" onClick={pieceArrived}>Pezzo arrivato, torna in Da fare</button>
          )}
        </div>
      </div>
    </div>
  )
}

const canCreatePlanned = (user) => ['admin', 'Responsabile', 'Direzione', 'Direttore Centro Congressi'].includes(user.role) || user.department === 'Reception'
const canViewPlanned = (user) => canCreatePlanned(user) || ['manutentore','Tecnico esterno'].includes(user.role)
const canViewPlanningMenu = (user) => ['manutentore','Direttore Centro Congressi'].includes(user.role)
const canViewTemperature = (user) => ['Direzione','Direttore Centro Congressi','manutentore'].includes(user.role) || user.department === 'Reception'
const canViewHousekeeping = (user) => ['Direzione','Direttore Centro Congressi','Portiere Notturno'].includes(user.role) || ['Reception','Governante'].includes(user.department)
const toLocalDateTimeInput = (timestamp) => {
  const date = new Date(timestamp)
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0,16)
}

function PlannedCard({ item, user, onOpen }) {
  const assigned = item.assignees?.some((person) => person.id === user.id)
  const doneRooms = Object.keys(item.roomsDone || {}).length
  const progress = item.rooms?.length ? Math.round(doneRooms / item.rooms.length * 100) : 0
  return <article className={`planned-card ${assigned ? 'assigned' : ''}`} onClick={onOpen} role="button" tabIndex={0}>
    <div className="planned-accent" /><div className="planned-body"><div className="planned-location"><small>{item.locationMode === 'camera' ? 'CAM.' : 'ZONA'}</small><strong>{item.location}</strong></div><div className="planned-content"><div className="planned-badges"><span>{item.category}</span><span className={item.status}>{item.status === 'waiting' ? 'Attesa pezzo' : 'Pianificato'}</span>{assigned && <span className="you">Tu</span>}</div><p>{item.notes || 'Nessuna nota'}</p>{item.rooms?.length > 0 && <div className="room-progress"><i><b style={{width:`${progress}%`}} /></i><span>{doneRooms} di {item.rooms.length} camere · {progress}%</span></div>}<small>◷ Da {new Date(item.scheduledAt).toLocaleString('it-IT', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })} · A {new Date(item.scheduledUntil || item.scheduledAt).toLocaleString('it-IT', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</small><div className="planned-assignees">{item.assignees?.map((person) => <span key={person.id}>👤 {person.name}</span>)}</div></div></div>
  </article>
}

function PlannedForm({ hotel, users, initial, onClose, onSave }) {
  const catalog = HOTEL_LOCATIONS[hotel.id]
  const [mode, setMode] = useState(initial?.locationMode || 'camera')
  const [draft, setDraft] = useState(initial || { location:'', category:'Varie', notes:'', scheduledAt:'', scheduledUntil:'', assignees:[] })
  const [groupIds, setGroupIds] = useState(initial?.roomGroupIds || [])
  const candidates = users.filter((person) => person.hotels.includes(hotel.id) && ['manutentore','Tecnico esterno'].includes(person.role))
  const isChecklist = ['Pulizia filtri','Idromassaggio','Extra Piani'].includes(draft.category)
  const isMultiFloor = draft.category === 'Extra Piani'
  const availableGroupEntries = catalog.roomGroups.map((group,index) => ({ group,index })).filter(({group}) => draft.category !== 'Idromassaggio' || (hotel.id === 'hotelgio' && group.name.startsWith('Jazz')))
  const selectedGroups = catalog.roomGroups.filter((_, index) => groupIds.includes(index))
  const checklistRooms = selectedGroups.flatMap((group) => draft.category === 'Idromassaggio' ? group.rooms.filter((room) => Number(room) % 2 === 0) : group.rooms)
  const validLocation = isChecklist ? selectedGroups.length > 0 : mode === 'camera' ? catalog.roomGroups.some((group) => group.rooms.includes(draft.location.trim())) : catalog.zones.some((zone) => zone.name === draft.location.trim())
  const validPeriod = draft.scheduledAt && draft.scheduledUntil && new Date(draft.scheduledUntil) >= new Date(draft.scheduledAt)
  const valid = validLocation && (isChecklist || draft.notes.trim()) && validPeriod && draft.assignees.length
  const pickGroup = (index) => setGroupIds((current) => isMultiFloor ? current.includes(index) ? current.filter((item) => item !== index) : [...current,index] : [index])
  const toggleAssignee = (person) => setDraft((current) => ({ ...current, assignees: current.assignees.some((item) => item.id === person.id) ? current.assignees.filter((item) => item.id !== person.id) : [...current.assignees, { id:person.id, name:person.name, role:person.role }] }))
  return <div className="urgent-transform-backdrop" onClick={onClose}><form className="planned-form" onClick={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); if (valid) onSave({ ...draft, location:isChecklist ? selectedGroups.map((group) => group.name).join(', ') : draft.location, locationMode:isChecklist ? 'zona' : mode, roomGroupIds:groupIds, rooms:isChecklist ? checklistRooms : null, roomsDone:draft.roomsDone || {} }) }}>
    <header><div><h2>{initial ? 'Modifica intervento pianificato' : 'Nuovo intervento pianificato'}</h2><p>Compila tutti i campi obbligatori.</p></div><button type="button" className="panel-close" onClick={onClose}><Icon name="close" /></button></header>
    {!isChecklist && <label>Camera o zona *<LocationAutocomplete catalog={catalog} mode={mode} onModeChange={setMode} value={draft.location} onChange={(location) => setDraft({ ...draft, location })} />{draft.location && !validLocation && <small className="field-error">Camera o zona non valida.</small>}</label>}
    <fieldset className="choice-field"><legend>Categoria *</legend><div className="category-choices">{ISSUE_CATEGORIES.map((item) => <button type="button" key={item} className={draft.category === item ? 'active' : ''} onClick={() => { if(draft.category !== item) setGroupIds([]); setDraft({ ...draft, category:item }) }}>{item}</button>)}</div></fieldset>
    {isChecklist && <fieldset className="choice-field"><legend>{isMultiFloor ? 'Piani *' : 'Piano *'}</legend><div className="floor-choices">{availableGroupEntries.map(({group,index}) => <button type="button" key={group.name} className={groupIds.includes(index) ? 'active' : ''} onClick={() => pickGroup(index)}>{group.name}</button>)}</div>{checklistRooms.length > 0 && <small>{checklistRooms.length} camere da spuntare</small>}</fieldset>}
    <label>Descrizione *<textarea rows="4" value={draft.notes} onChange={(event) => setDraft({ ...draft, notes:event.target.value })} placeholder="Descrivi l’intervento..." /></label>
    <fieldset className="choice-field"><legend>Periodo previsto *</legend><div className="planned-period"><label>Da<input type="datetime-local" value={draft.scheduledAt} onChange={(event) => setDraft({ ...draft, scheduledAt:event.target.value })} /></label><label>A<input type="datetime-local" value={draft.scheduledUntil} min={draft.scheduledAt} onChange={(event) => setDraft({ ...draft, scheduledUntil:event.target.value })} /></label></div>{draft.scheduledAt && draft.scheduledUntil && !validPeriod && <small className="field-error">La data “A” deve essere successiva alla data “Da”.</small>}</fieldset>
    <fieldset className="choice-field"><legend>Assegna a *</legend><div className="assignee-choices">{candidates.map((person) => <button type="button" key={person.id} className={draft.assignees.some((item) => item.id === person.id) ? 'active' : ''} onClick={() => toggleAssignee(person)}>👤 <span>{person.name}<small>{person.role}</small></span></button>)}</div></fieldset>
    <div className="form-actions"><button type="button" className="secondary" onClick={onClose}>Annulla</button><button className="planned-submit" disabled={!valid}>{initial ? 'Salva modifiche' : 'Pianifica intervento'}</button></div>
  </form></div>
}

function PlannedDetail({ item, user, onClose, onUpdate, onDelete, onEdit, onCompleteToIssues }) {
  const [photo, setPhoto] = useState(null)
  const canComplete = canViewPlanned(user)
  const roomsDone = item.roomsDone || {}
  const formatDay = (timestamp) => new Date(timestamp).toLocaleDateString('it-IT', { weekday:'short', day:'2-digit', month:'short' })
  const formatTime = (timestamp) => new Date(timestamp).toLocaleTimeString('it-IT', { hour:'2-digit', minute:'2-digit' })
  const toggleRoom = (room) => { const next={...roomsDone}; if(next[room]) delete next[room]; else next[room]={by:user.name,at:Date.now()}; onUpdate({roomsDone:next},false) }
  return <div className="urgent-transform-backdrop" onClick={onClose}><section className="planned-detail" onClick={(event) => event.stopPropagation()}>
    <header><button className="back-link" onClick={onClose}>‹ Chiudi</button><div>{canCreatePlanned(user) && <button className="planned-edit" onClick={onEdit}>Modifica</button>}{canCreatePlanned(user) && <button className="delete-issue-compact" onClick={onDelete}>Elimina</button>}</div></header>
    <h2>{item.locationMode === 'camera' ? `Camera ${item.location}` : item.location} · Intervento</h2>
    <article><small>DETTAGLI INTERVENTO</small><span className="planned-category">{item.category}</span><p>{item.notes}</p>{item.rooms?.length > 0 && <div className="room-checklist"><strong>{Object.keys(roomsDone).length} di {item.rooms.length} camere</strong><div>{item.rooms.map((room) => <button key={room} className={roomsDone[room] ? 'done' : ''} onClick={() => toggleRoom(room)}>{room}</button>)}</div><small>Tocca di nuovo una camera per togliere la spunta.</small></div>}<em>Creato da {item.createdBy} · {new Date(item.createdAt).toLocaleString('it-IT')}</em></article>
    <div className="planned-meta-grid">
      <article className="planned-date"><small>PERIODO PREVISTO</small><div className="planned-date-range"><span><i>DA</i><strong>{formatDay(item.scheduledAt)}</strong><b>{formatTime(item.scheduledAt)}</b></span><span><i>A</i><strong>{formatDay(item.scheduledUntil || item.scheduledAt)}</strong><b>{formatTime(item.scheduledUntil || item.scheduledAt)}</b></span></div></article>
      <article className="planned-assignment"><small>ASSEGNATO A</small><div className="planned-assignees">{item.assignees.map((person) => <span key={person.id}>👤 {person.name}</span>)}</div></article>
    </div>
    <label className={`planned-photo ${photo ? 'has-photo' : ''}`}><input type="file" accept="image/*" capture="environment" onChange={async (event) => setPhoto(await readPhotoAsDataUrl(event.target.files?.[0]))} /><span className="planned-photo-icon"><Icon name="camera" /></span><span><strong>{photo ? 'Cambia foto finale' : 'Aggiungi foto finale'}</strong><small>Opzionale · scatta o scegli una foto</small></span>{photo && <img src={photo} alt="Anteprima foto finale" />}</label>
    {canComplete && <div className="planned-actions"><button className="planned-complete" onClick={() => onCompleteToIssues(photo)}>✓ Intervento completato</button></div>}
  </section></div>
}

function InterventionsSection({ items, user, onOpen, onShowCompleted }) {
  const [search, setSearch] = useState('')
  const pending = items.filter((item) => item.status !== 'done')
  const done = items.filter((item) => item.status === 'done')
  const filtered = pending.filter((item) => !search || `${item.location} ${item.notes} ${item.assignees?.map((person) => person.name).join(' ')}`.toLowerCase().includes(search.toLowerCase()))
  return <section className="interventions-section">
    {canCreatePlanned(user) && pending.length > 0 && <div className="planned-stats"><article><strong>{pending.length}</strong><span>Da fare</span></article><button onClick={onShowCompleted}><strong>{done.length}</strong><span>Completati →</span></button></div>}
    <label className="search planned-search"><span className="sr-only">Cerca interventi</span><Icon name="search"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cerca camera, nome, assegnatario..." /></label>
    {filtered.length > 0 && <h2 className="planned-list-title">Da completare · {filtered.length}</h2>}
    <div className="planned-list">{filtered.map((item) => <PlannedCard key={item.id} item={item} user={user} onOpen={() => onOpen(item.id)} />)}{!filtered.length && <div className="planned-empty"><Icon name="calendar"/><strong>Nessun intervento da completare</strong>{done.length > 0 && <span>✓ {done.length} completati — vedi in Segnalazioni › Completate</span>}{canCreatePlanned(user) && <small>Usa il pulsante + per crearne uno</small>}</div>}</div>
  </section>
}

function Operations({ hotel, user, users, onLogout, onChangeHotel, onSavePin, uiSize, onUiSizeChange }) {
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
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPanel, setMenuPanel] = useState(null)
  const [allIssues, setAllIssues] = useState([])
  const [issuesLoading, setIssuesLoading] = useState(true)
  const [issuesError, setIssuesError] = useState('')
  const [urgentItems, setUrgentItems] = useState(loadUrgents)
  const [urgentComposeRequest, setUrgentComposeRequest] = useState(0)
  const [urgentTransformTarget, setUrgentTransformTarget] = useState(null)
  const [plannedItems, setPlannedItems] = useState(loadPlanned)
  const [plannedFormOpen, setPlannedFormOpen] = useState(false)
  const [openPlannedId, setOpenPlannedId] = useState(null)
  const [editingPlannedId, setEditingPlannedId] = useState(null)

  useEffect(() => {
    let cancelled = false

    const loadRemoteIssues = async () => {
      setIssuesLoading(true)
      setIssuesError('')
      try {
        const remoteIssues = await fetchIssues(hotel.id)
        if (!cancelled) setAllIssues(remoteIssues)
      } catch (error) {
        console.error('load issues error', error)
        if (!cancelled) setIssuesError(error?.message || 'Impossibile caricare le segnalazioni')
      } finally {
        if (!cancelled) setIssuesLoading(false)
      }
    }

    loadRemoteIssues()
    return () => { cancelled = true }
  }, [hotel.id])

  const updateUrgents = (next) => { persistUrgents(next); setUrgentItems(next) }
  const updatePlannedItems = (next) => { localStorage.setItem(PLANNED_STORAGE_KEY, JSON.stringify(next)); setPlannedItems(next) }

  const saveIssue = async (issue) => {
    try {
      const created = await createIssue(issue)
      setAllIssues((current) => [created, ...current])
      setStatus('todo')
      setTab('Segnalazioni')
      setCreatingIssue(false)
    } catch (error) {
      console.error('save issue error', error)
      window.alert(error?.message || 'Impossibile salvare la segnalazione')
      throw error
    }
  }

  const updateIssue = async (id, changes) => {
    try {
      const updated = await updateIssueRemote(id, changes)
      if (!updated) return
      setAllIssues((current) => current.map((item) => item.id === id ? updated : item))
    } catch (error) {
      console.error('update issue error', error)
      window.alert(error?.message || 'Impossibile aggiornare la segnalazione')
    }
  }

  const deleteIssue = async (id) => {
    try {
      await deleteIssueRemote(id)
      setAllIssues((current) => current.filter((item) => item.id !== id))
    } catch (error) {
      console.error('delete issue error', error)
      window.alert(error?.message || 'Impossibile eliminare la segnalazione')
    }
  }
  const openIssue = allIssues.find((item) => item.id === openIssueId) || null

  const permissions = ROLE_PERMISSIONS[user.role] || []
  const tabs = ['Segnalazioni', ...(canViewUrgent(user) ? ['Avvisi Urgenti'] : []), ...(canViewPlanned(user) ? ['Interventi'] : []), ...(hotel.id === 'hotelgio' && canViewHousekeeping(user) ? ['Housekeeping'] : [])]
  const tabIcons = { Segnalazioni: 'clipboard', 'Avvisi Urgenti': 'alert', Interventi: 'tool', Housekeeping: 'housekeeping', 'Planning Lavori': 'calendar', 'Planning Sale': 'calendar' }
  const hotelIssues = useMemo(() => allIssues.filter((issue) => issue.hotelId === hotel.id), [allIssues, hotel.id])
  const hotelPlanned = useMemo(() => plannedItems.filter((item) => item.hotelId === hotel.id), [plannedItems, hotel.id])
  const openPlanned = hotelPlanned.find((item) => item.id === openPlannedId) || null
  const editingPlanned = hotelPlanned.find((item) => item.id === editingPlannedId) || null
  const pendingPlannedCount = hotelPlanned.filter((item) => item.status !== 'done').length
  const statusCounts = useMemo(() => hotelIssues.reduce((acc, issue) => ({ ...acc, [issue.status]: (acc[issue.status] || 0) + 1 }), {}), [hotelIssues])
  const issues = useMemo(() => allIssues
    .filter((issue) => issue.hotelId === hotel.id && issue.status === status)
    .filter((issue) => !query || `${issue.room} ${issue.title}`.toLowerCase().includes(query.toLowerCase()))
    .filter((issue) => !department || issue.department === department)
    .filter((issue) => !category || issue.category === category)
    .sort((a, b) => {
      if (sort === 'camera') return a.room.localeCompare(b.room, 'it', { numeric: true })
      if (sort === 'data') return (b.createdAt || 0) - (a.createdAt || 0)
      const weight = { alta: 3, media: 2, bassa: 1 }
      return weight[b.urgency] - weight[a.urgency] || (b.createdAt || 0) - (a.createdAt || 0)
    }), [allIssues, hotel.id, status, query, sort, department, category])
  const openPanel = (panel) => { setMenuOpen(false); setMenuPanel(panel) }
  const goToWorkPlanning = () => { setTab('Planning Lavori'); setMenuOpen(false) }
  const goToPlanning = () => { setTab('Planning Sale'); setMenuOpen(false) }
  const goToTemperature = () => { setTab('Temperature'); setMenuOpen(false) }
  const isDedicatedPage = tab === 'Planning Lavori' || tab === 'Planning Sale' || tab === 'Temperature'
  const updateUrgent = (id, changes) => updateUrgents(urgentItems.map((item) => item.id === id ? { ...item, ...changes } : item))
  const takeUrgent = (id) => updateUrgent(id, { status: 'presa_in_carico', takenBy: user.name, takenAt: Date.now() })
  const completeUrgent = (id) => updateUrgent(id, { status: 'completata', completedBy: user.name, completedAt: Date.now() })
  const transformUrgent = async (urgent, data) => {
    try {
      const created = await createIssue({
        hotelId: hotel.id,
        urgency: data.urgency,
        room: `${data.mode === 'camera' ? 'Camera' : 'Zona'} · ${data.location.trim()}`,
        title: data.note.trim(),
        status: 'todo',
        department: user.department || user.role,
        category: data.category,
        origin: 'Avviso urgente',
        createdAt: Date.now(),
        createdBy: user.id,
        createdByName: user.name,
      })
      setAllIssues((current) => [created, ...current])
      updateUrgent(urgent.id, { status: 'completata', completedBy: user.name, completedAt: Date.now(), transformed: true })
      setUrgentTransformTarget(null)
    } catch (error) {
      console.error('transform urgent error', error)
      window.alert(error?.message || 'Impossibile trasformare l’avviso')
    }
  }
  const openUrgentCount = urgentItems.filter((item) => item.hotelId === hotel.id && item.status !== 'completata').length
  const activeUrgents = urgentItems.filter((item) => item.hotelId === hotel.id && item.status !== 'completata')
  useEffect(() => { if (canManageUrgent(user) && openUrgentCount) playUrgentSignal() }, [openUrgentCount, user])
  const savePlanned = (draft) => {
    const dates = { scheduledAt:new Date(draft.scheduledAt).getTime(), scheduledUntil:new Date(draft.scheduledUntil).getTime() }
    const item = editingPlanned ? { ...editingPlanned, ...draft, ...dates, updatedAt:Date.now() } : { ...draft, ...dates, id:Date.now(), hotelId:hotel.id, status:'pending', createdAt:Date.now(), createdBy:user.name }
    updatePlannedItems(editingPlanned ? plannedItems.map((current) => current.id === item.id ? item : current) : [item, ...plannedItems])
    setPlannedFormOpen(false); setEditingPlannedId(null)
  }
  const updatePlanned = (id, changes, close = true) => { updatePlannedItems(plannedItems.map((item) => item.id === id ? { ...item, ...changes } : item)); if (close) setOpenPlannedId(null) }
  const deletePlanned = (id) => { if (!window.confirm('Eliminare questo intervento?')) return; updatePlannedItems(plannedItems.filter((item) => item.id !== id)); setOpenPlannedId(null) }
  const completePlanned = async (item, completionPhotoData = null) => {
    const completedAt = Date.now()
    try {
      const created = await createIssue({
        hotelId: hotel.id,
        urgency: 'media',
        room: `${item.locationMode === 'camera' ? 'Camera' : 'Zona'} · ${item.location}`,
        title: item.notes,
        status: 'done',
        department: user.role,
        category: item.category,
        origin: 'Intervento pianificato',
        createdAt: item.createdAt,
        createdBy: user.id,
        createdByName: user.name,
        completedAt,
        completedBy: user.name,
        pieceReplaced: item.pieceReplaced || null,
      })
      setAllIssues((current) => [created, ...current])
      updatePlannedItems(plannedItems.map((current) => current.id === item.id ? { ...current, status:'done', completedBy:user.name, completedAt, photoAfter:completionPhotoData } : current))
      setOpenPlannedId(null)
    } catch (error) {
      console.error('complete planned error', error)
      window.alert(error?.message || 'Impossibile completare l’intervento')
    }
  }

  return (
    <div className={`operations theme-${hotel.tone}`}>
      <header className="ops-header">
        <div className="hotel-identity"><HotelMark hotel={hotel} /><span><strong>{hotel.name}</strong><small>{user.name} · {user.role}</small></span></div>
        <button className={`presence ${presence ? 'on' : ''}`} onClick={() => setPresence(!presence)}><span /> Sono in struttura</button>
        <button className="icon-button menu-trigger" onClick={() => setMenuOpen(true)} aria-label="Apri menu" aria-expanded={menuOpen}><Icon name="menu" /></button>
      </header>
      {menuOpen && <div className="drawer-backdrop" onClick={() => setMenuOpen(false)}>
        <aside className="app-drawer" aria-label="Menu principale" onClick={(event) => event.stopPropagation()}>
          <header><div><strong>{hotel.name}</strong><span>{user.name} · {user.role}</span></div><button className="panel-close" onClick={() => setMenuOpen(false)} aria-label="Chiudi menu"><Icon name="close" /></button></header>
          <nav>
            <button onClick={() => window.location.reload()}><Icon name="refresh" /><span>Aggiorna</span></button>
            <button onClick={onChangeHotel}><Icon name="hotel" /><span>Cambia struttura</span></button>
            <button onClick={() => openPanel('pin')}><Icon name="lock" /><span>Cambia PIN</span></button>
            <button onClick={() => openPanel('notifications')}><Icon name="bell" /><span>Notifiche</span></button>
            <button onClick={() => openPanel('manual')}><Icon name="book" /><span>Manuale</span></button>
            <button onClick={() => openPanel('feedback')}><Icon name="message" /><span>Feedback</span></button>
            <button onClick={() => { exportIssuesCsv(allIssues, hotel); setMenuOpen(false) }} disabled={!hotelIssues.length}><Icon name="download" /><span>Esporta CSV</span></button>
            {canViewPlanningMenu(user) && <button onClick={goToWorkPlanning}><Icon name="calendar" /><span>Planning lavori</span></button>}
            {hotel.id === 'hotelgio' && canViewPlanningMenu(user) && <button onClick={goToPlanning}><Icon name="calendar" /><span>Planning Sale</span></button>}
            {hotel.id === 'hotelgio' && canViewTemperature(user) && <button onClick={goToTemperature}><Icon name="temperature" /><span>Temperature</span></button>}
          </nav>
          <fieldset className="ui-scale-setting"><legend>Dimensione interfaccia</legend><div>{[['small','Piccola'],['normal','Normale'],['large','Grande']].map(([value,label])=><button type="button" className={uiSize===value?'active':''} aria-pressed={uiSize===value} onClick={()=>onUiSizeChange(value)} key={value}>{label}</button>)}</div><small>Ingrandisce testi, pulsanti e schede.</small></fieldset>
          <button className="drawer-logout" onClick={onLogout}><Icon name="logout" /><span>Logout</span></button>
        </aside>
      </div>}
      {menuPanel && <MenuPanel type={menuPanel} user={user} onClose={() => setMenuPanel(null)} onSavePin={onSavePin} />}
      {urgentTransformTarget && <UrgentTransformModal urgent={urgentTransformTarget} hotel={hotel} onClose={() => setUrgentTransformTarget(null)} onSave={(data) => transformUrgent(urgentTransformTarget, data)} />}
      {(plannedFormOpen || editingPlanned) && <PlannedForm hotel={hotel} users={users} initial={editingPlanned ? { ...editingPlanned, scheduledAt:toLocalDateTimeInput(editingPlanned.scheduledAt), scheduledUntil:toLocalDateTimeInput(editingPlanned.scheduledUntil || editingPlanned.scheduledAt) } : null} onClose={() => { setPlannedFormOpen(false); setEditingPlannedId(null) }} onSave={savePlanned} />}
      {openPlanned && <PlannedDetail item={openPlanned} user={user} onClose={() => setOpenPlannedId(null)} onUpdate={(changes,close) => updatePlanned(openPlanned.id,changes,close)} onDelete={() => deletePlanned(openPlanned.id)} onEdit={() => { setEditingPlannedId(openPlanned.id); setOpenPlannedId(null) }} onCompleteToIssues={(photo) => completePlanned(openPlanned,photo)} />}
      <main className={`ops-main ${isDedicatedPage ? 'planning-page-main' : ''}`}>
        {isDedicatedPage ? <button className="planning-back" onClick={() => setTab('Segnalazioni')}>‹ Area operativa</button> : tab !== 'Housekeeping' && <div className="title-row ops-title"><h1>{tab}</h1></div>}
        {!isDedicatedPage && <nav className="tabs" aria-label="Sezioni principali">{tabs.map((item) => <button className={tab === item ? 'active' : ''} key={item} onClick={() => setTab(item)}><Icon name={tabIcons[item]} /><span>{item}</span>{item === 'Avvisi Urgenti' && openUrgentCount > 0 && <b className="tab-badge">{openUrgentCount}</b>}{item === 'Interventi' && pendingPlannedCount > 0 && <b className="tab-badge planned-badge">{pendingPlannedCount}</b>}</button>)}</nav>}
        {tab !== 'Avvisi Urgenti' && canManageUrgent(user) && <UrgentBanner items={activeUrgents} onOpen={() => setTab('Avvisi Urgenti')} onTake={takeUrgent} onComplete={completeUrgent} onTransform={setUrgentTransformTarget} />}
        {openIssue && <IssueDetail issue={openIssue} permissions={permissions} currentUser={user} onClose={() => setOpenIssueId(null)} onUpdate={updateIssue} onDelete={deleteIssue} />}
        {tab === 'Segnalazioni' ? <>
          {issuesLoading && <div className="empty"><strong>Caricamento segnalazioni…</strong><span>Sincronizzazione con Supabase in corso.</span></div>}
          {issuesError && <div className="empty"><strong>Errore sincronizzazione</strong><span>{issuesError}</span></div>}
          {creatingIssue && <NewIssueForm hotel={hotel} user={user} onCancel={()=>setCreatingIssue(false)} onSave={saveIssue} />}
          <div className="status-tabs">{[['todo','Da fare'],['tecnico','Tecnico'],['waiting','Attesa pezzo'],['done','Completate']].map(([key,label]) => <button className={status === key ? 'active' : ''} key={key} onClick={() => setStatus(key)}>{label} <span className="status-count">{statusCounts[key] || 0}</span></button>)}</div>
          <div className="toolbar"><label className="search"><span className="sr-only">Cerca segnalazioni</span><Icon name="search"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cerca camera, zona o problema" /></label><div className="toolbar-actions"><select aria-label="Ordinamento" value={sort} onChange={(event) => setSort(event.target.value)}><option value="urgenza">Ordina: urgenza</option><option value="camera">Ordina: camera/zona</option><option value="data">Ordina: data</option></select><button className={`secondary filter-toggle ${advanced ? 'active' : ''}`} onClick={() => setAdvanced(!advanced)} aria-expanded={advanced}><Icon name="filter" /><span>Filtri</span><Icon name="chevron" /></button></div></div>
          {advanced && <div className="advanced-filters"><select value={department} onChange={(event) => setDepartment(event.target.value)}><option value="">Tutti i reparti</option><option>Governante</option><option>Reception</option><option>Isola dei Golosi</option></select><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">Tutte le categorie</option><option>Idraulica</option><option>Elettrica</option><option>Climatizzazione</option></select><select disabled><option>Origine: tutte</option></select><input type="date" aria-label="Data" /></div>}
          <section className="issue-list" aria-live="polite">{issues.length ? issues.map((issue) => <article className={`issue ${issue.urgency}`} key={issue.id} onClick={() => setOpenIssueId(issue.id)} role="button" tabIndex={0} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setOpenIssueId(issue.id)}><span className="urgency">{issue.urgency}</span><div><h3>{issue.room}</h3><p>{issue.title}</p><small>{issue.department} · {issue.category} · {issue.date}{issue.photoData ? ' · Foto' : ''}{issue.status === 'waiting' ? ` · In attesa: ${issue.pieceName}` : ''}{issue.status === 'tecnico' ? ' · Tecnico richiesto' : ''}</small></div><Icon name="arrow" /></article>) : <div className="empty"><strong>Nessuna segnalazione</strong><span>Non ci sono elementi con questi filtri.</span></div>}</section>
        </> : tab === 'Avvisi Urgenti' ? <UrgentSection hotel={hotel} user={user} items={urgentItems} openRequest={urgentComposeRequest} onItemsChange={updateUrgents} onTake={takeUrgent} onComplete={completeUrgent} onTransform={setUrgentTransformTarget} /> : tab === 'Interventi' ? <InterventionsSection items={hotelPlanned} user={user} onOpen={setOpenPlannedId} onShowCompleted={() => { setTab('Segnalazioni'); setStatus('done') }} /> : tab === 'Planning Lavori' ? <PlanningWork items={hotelPlanned} onOpen={setOpenPlannedId} /> : tab === 'Planning Sale' ? <PlanningSale user={user} /> : tab === 'Temperature' ? <TemperatureSensors /> : tab === 'Housekeeping' ? <Housekeeping user={user} /> : <div className="placeholder"><h2>{tab}</h2><p>Sezione predisposta per la prossima fase.</p></div>}
      </main>
      {!['Temperature','Housekeeping'].includes(tab) && <p className="local-data-note">{isSupabaseConfigured ? 'Dati sincronizzati con Supabase' : 'Dati salvati solo localmente su questo dispositivo'}</p>}
      {tab === 'Segnalazioni' && permissions.includes('create') && !creatingIssue && !openIssue && (
        <button className="fab-new-issue" onClick={() => setCreatingIssue(true)} aria-label="Nuova segnalazione">
          <span className="fab-plus">+</span> Nuova segnalazione
        </button>
      )}
      {canSendUrgent(user) && <button className="urgent-fab" onClick={() => { setTab('Avvisi Urgenti'); setUrgentComposeRequest((value) => value + 1) }} aria-label="Invia avviso urgente" title="Avviso urgente">🚨</button>}
      {tab === 'Interventi' && canCreatePlanned(user) && <button className="fab-new-issue planned-fab" onClick={() => setPlannedFormOpen(true)}>＋ Nuovo intervento</button>}
      {tab === 'Planning Lavori' && canViewPlanningMenu(user) && <button className="fab-new-issue planned-fab" onClick={() => setPlannedFormOpen(true)}>＋ Nuovo lavoro</button>}
    </div>
  )
}

export default function App() {
  const [uiSize, setUiSize] = useState(() => {
    const saved = localStorage.getItem(UI_SIZE_STORAGE_KEY)
    return ['small','normal','large'].includes(saved) ? saved : 'normal'
  })
  const [users, setUsers] = useState(loadUsers)
  const [adminStage, setAdminStage] = useState(null)
  const [session, setSession] = useState(loadSession)
  const [authUser, setAuthUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [selectedHotel, setSelectedHotel] = useState(() => HOTELS.find((hotel) => hotel.id === session?.hotelId) || null)

  const hotel = HOTELS.find((item) => item.id === session?.hotelId)
  const user = authUser || users.find((item) => item.id === session?.userId)

  const updateUsers = (next) => {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(next))
    setUsers(next)
  }

  const mergeAuthenticatedUser = (nextUser) => {
    setAuthUser(nextUser)
    setUsers((current) => {
      const exists = current.some((item) => item.id === nextUser.id)
      const next = exists
        ? current.map((item) => item.id === nextUser.id ? { ...item, ...nextUser } : item)
        : [...current, nextUser]

      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  const updateCurrentUserPin = (nextPin) => {
    // Temporaneo: l'autenticazione vera è già su Supabase.
    // Il cambio PIN remoto verrà collegato alla relativa Edge Function.
    updateUsers(users.map((item) => item.id === user?.id ? { ...item, pin: nextPin } : item))
  }

  const login = async (nextUser) => {
    mergeAuthenticatedUser(nextUser)
    const next = { hotelId: selectedHotel.id, userId: nextUser.id, createdAt: Date.now() }
    saveSession(next)
    setSession(next)
  }

  const logout = async () => {
    await logoutPinSession()
    clearSession()
    setSession(null)
    setAuthUser(null)
    setSelectedHotel(null)
  }

  const changeHotel = async () => {
    await logoutPinSession()
    clearSession()
    setSession(null)
    setAuthUser(null)
    setSelectedHotel(null)
  }

  useEffect(() => {
    let active = true

    const restore = async () => {
      try {
        const restoredUser = await restorePinSession()
        if (!active) return

        if (!restoredUser) {
          if (session) {
            clearSession()
            setSession(null)
          }
          setAuthUser(null)
          return
        }

        mergeAuthenticatedUser(restoredUser)

        if (session?.hotelId && restoredUser.hotels.includes(session.hotelId)) {
          setSelectedHotel(HOTELS.find((item) => item.id === session.hotelId) || null)
        } else if (session) {
          clearSession()
          setSession(null)
          setSelectedHotel(null)
        }
      } catch (error) {
        console.error('restore auth error', error)
        clearSession()
        if (active) {
          setSession(null)
          setAuthUser(null)
          setSelectedHotel(null)
        }
      } finally {
        if (active) setAuthReady(true)
      }
    }

    restore()
    return () => { active = false }
  }, [])

  useEffect(() => {
    document.documentElement.dataset.uiSize = uiSize
    localStorage.setItem(UI_SIZE_STORAGE_KEY, uiSize)
  }, [uiSize])

  if (!authReady) {
    return <div className="page login-page"><main className="login-panel"><strong>Caricamento sessione…</strong></main></div>
  }

  if (session && hotel && user && user.hotels?.includes(hotel.id)) {
    return <Operations hotel={hotel} user={user} users={users} onLogout={logout} onChangeHotel={changeHotel} onSavePin={updateCurrentUserPin} uiSize={uiSize} onUiSizeChange={setUiSize} />
  }

  if (adminStage === 'panel') return <div className="operations"><main className="ops-main global-admin"><AdminPanel users={users} onUsersChange={updateUsers} onClose={() => setAdminStage(null)} /></main></div>
  if (adminStage === 'pin') return <AdminGate onBack={() => setAdminStage(null)} onSuccess={() => setAdminStage('panel')} />
  if (selectedHotel) return <Login hotel={selectedHotel} users={users} onBack={() => setSelectedHotel(null)} onLogin={login} />
  return <Home onSelect={setSelectedHotel} onAdmin={() => setAdminStage('pin')} />
}
