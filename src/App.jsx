import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DEPARTMENTS, HOTELS, ROLE_PERMISSIONS, ROLES } from './config.js'
import { clearSession, loadSession, saveSession } from './session.js'
import { fetchDirectory, fetchUsers, insertUser, updateUserRow, setUserActive, updateUserPin, getTechnicianLink, permanentlyDeleteUser } from './users-data.js'
import { loginWithPin, loginAdmin, changeOwnPin, setOwnPresence, updateOwnProfile, validateSupabaseSession, signOutSupabase } from './auth-data.js'
import { subscribeToPush, unsubscribeFromPush, getPushSubscriptionState } from './push.js'
import { SOUNDS, getNotifSound, setNotifSound, playNotifSound } from './notification-sound.js'
import { insertFeedback, fetchFeedback, subscribeFeedback } from './feedback-data.js'
import { fetchIssues, insertIssue, updateIssueRow, deleteIssueRow, subscribeIssues } from './issues-data.js'
import { fetchUrgents, insertUrgent, updateUrgentRow, subscribeUrgents, notifyUrgent } from './urgents-data.js'
import { fetchPlanned, insertPlanned, updatePlannedRow, deletePlannedRow, subscribePlanned } from './planned-data.js'
import { SensorsPanel } from './sensors-panel.jsx'
import { isSupabaseConfigured } from './supabase.js'
import { HOTEL_LOCATIONS } from './locations.js'
import { PlanningSale, PlanningWork } from './planning.jsx'
import { TemperatureSensors } from './temperature.jsx'
import { Housekeeping } from './housekeeping.jsx'

const UI_SIZE_STORAGE_KEY = 'apicehotel.ui-size.v1'
const loadUiSize = () => {
  try { const saved = localStorage.getItem(UI_SIZE_STORAGE_KEY); return ['small','normal','large'].includes(saved) ? saved : 'normal' } catch { return 'normal' }
}
const saveUiSize = (value) => { try { localStorage.setItem(UI_SIZE_STORAGE_KEY, value) } catch { /* La sessione resta utilizzabile anche senza storage. */ } }
const ISSUE_CATEGORIES = ['Idraulico', 'Elettrico', 'Climatizzazione', 'Arredo', 'Edilizio', 'Giardinaggio', 'Pulizia filtri', 'Idromassaggio', 'Extra Piani', 'Varie']
const ROOM_STATUS_OPTIONS = [['fermata_libera','Fermata libera'],['fermata_cliente','Fermata con cliente'],['libera','Libera'],['in_arrivo','In arrivo']]
const ALL_HOTEL_IDS = HOTELS.map((hotel) => hotel.id)
const PERMISSION_LABELS = {
  manage_users: 'Gestione utenti', manage_all_hotels: 'Tutte le strutture', create: 'Crea segnalazioni', assign: 'Assegna lavori', complete: 'Completa lavori', read_all_departments: 'Tutti i reparti', planning_sale: 'Planning Sale', take_charge: 'Presa in carico', read_own_hotel: 'Lettura struttura'
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
    phone: <><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92Z" /></>,
  }
  return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

const canSendUrgent = (user) => ['Direzione', 'Direttore Centro Congressi'].includes(user.role) || user.department === 'Reception'
const canViewTechnicianDirectory = (user) => canSendUrgent(user) || user.role === 'admin'
const whatsappLink = (phone) => {
  const digits = String(phone || '').replace(/[^\d+]/g, '')
  return digits ? `https://wa.me/${digits.replace(/^\+/, '')}` : null
}
function TechnicianDirectory({ users, onClose }) {
  const technicians = users.filter((person) => person.role === 'Tecnico esterno').sort((a, b) => a.name.localeCompare(b.name, 'it'))
  return <div className="sheet-overlay" onClick={onClose}><div className="sheet" onClick={(event) => event.stopPropagation()}><div className="sheet-head"><button className="back-link" onClick={onClose}>‹ Chiudi</button></div><h2 className="detail-room">Rubrica tecnici</h2>{technicians.length ? <ul className="technician-list">{technicians.map((tech) => { const link = whatsappLink(tech.phone); return <li key={tech.id} className="technician-row"><div className="technician-info"><strong>{tech.name}</strong>{tech.phone && <small>{tech.phone}</small>}</div>{link && <a className="technician-whatsapp" href={link} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()} aria-label={`Scrivi su WhatsApp a ${tech.name}`}><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.6 6.32A7.85 7.85 0 0 0 12.05 4a7.94 7.94 0 0 0-6.9 11.9L4 20l4.21-1.1a7.93 7.93 0 0 0 3.8.97h0a7.95 7.95 0 0 0 5.59-13.55zm-5.55 12.2h0a6.6 6.6 0 0 1-3.36-.92l-.24-.14-2.5.65.67-2.44-.16-.25a6.6 6.6 0 1 1 12.27-3.5 6.56 6.56 0 0 1-6.68 6.6zm3.6-4.93c-.2-.1-1.17-.58-1.35-.64s-.31-.1-.45.1-.52.64-.64.78-.23.15-.43.05a5.42 5.42 0 0 1-1.6-.98 5.99 5.99 0 0 1-1.1-1.37c-.12-.2 0-.3.09-.4s.2-.23.3-.35a1.4 1.4 0 0 0 .2-.33.36.36 0 0 0 0-.35c0-.1-.45-1.08-.62-1.48s-.33-.33-.45-.33-.25 0-.38 0a.74.74 0 0 0-.53.25 2.23 2.23 0 0 0-.7 1.66 3.88 3.88 0 0 0 .82 2.05 8.86 8.86 0 0 0 3.39 3 11.5 11.5 0 0 0 1.13.42 2.7 2.7 0 0 0 1.25.08 2.04 2.04 0 0 0 1.34-.94 1.65 1.65 0 0 0 .12-.94c-.05-.1-.18-.15-.39-.25z"/></svg></a>}</li> })}</ul> : <div className="empty"><strong>Nessun tecnico esterno</strong><span>Aggiungine uno da Gestione utenti (ruolo "Tecnico esterno", con numero di telefono).</span></div>}</div></div>
}
const canManageUrgent = (user) => user.role === 'manutentore'
const canViewUrgent = (user) => canSendUrgent(user) || canManageUrgent(user)
// Sirena continua e assordante per gli avvisi urgenti: onda dentata che
// sale/scende senza pause, doppio oscillatore leggermente stonato per
// renderla piu' dura. Porting della sirena di App Apice Manutenzioni
// (HotelGio) al posto del semplice beep precedente.
//
// Un unico AudioContext condiviso, sbloccato al primo tocco dell'utente
// dopo il login (vedi useUnlockUrgentAudio) e ripreso (resume) prima di
// ogni riproduzione: i browser mobile avviano l'AudioContext "sospeso"
// finche' non viene sbloccato da un gesto utente, e la sirena parte da un
// evento realtime (non da un tocco), quindi senza questo accorgimento
// resterebbe muta.
let sharedUrgentCtx = null
function getSharedUrgentCtx() {
  if (!sharedUrgentCtx) sharedUrgentCtx = new (window.AudioContext || window.webkitAudioContext)()
  return sharedUrgentCtx
}
export function unlockUrgentAudio() {
  try {
    const ctx = getSharedUrgentCtx()
    if (ctx.state === 'suspended') ctx.resume()
    const buffer = ctx.createBuffer(1, 1, 22050)
    const source = ctx.createBufferSource()
    source.buffer = buffer; source.connect(ctx.destination); source.start(0)
  } catch { /* niente da fare se il browser non supporta Web Audio */ }
}
function useUnlockUrgentAudio(user) {
  useEffect(() => {
    if (!user) return
    const onFirstTouch = () => { unlockUrgentAudio(); window.removeEventListener('pointerdown', onFirstTouch) }
    window.addEventListener('pointerdown', onFirstTouch, { once: true })
    return () => window.removeEventListener('pointerdown', onFirstTouch)
  }, [user])
}
async function playUrgentSignal() {
  try {
    const ctx = getSharedUrgentCtx()
    if (ctx.state === 'suspended') await ctx.resume()
    const now = ctx.currentTime
    const duration = 5
    const masterGain = ctx.createGain()
    masterGain.gain.setValueAtTime(0.4, now)
    masterGain.connect(ctx.destination)
    const makeSweep = (startFreq, gainVal) => {
      const osc = ctx.createOscillator()
      osc.type = 'sawtooth'
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(gainVal, now)
      osc.connect(gain); gain.connect(masterGain)
      let t = now
      osc.frequency.setValueAtTime(startFreq, t)
      while (t < now + duration) {
        t += 0.18; osc.frequency.linearRampToValueAtTime(startFreq + 600, t)
        t += 0.18; osc.frequency.linearRampToValueAtTime(startFreq, t)
      }
      osc.start(now); osc.stop(t)
    }
    makeSweep(650, 1); makeSweep(660, 0.6)
    navigator.vibrate?.([400, 80, 400, 80, 400, 80, 400, 80, 400])
  } catch { /* Il browser può bloccare l'audio fuori da un gesto utente. */ }
}
// Un urgente puo' arrivare da due strade quasi simultanee (sottoscrizione
// realtime sulla tabella + messaggio dal service worker sul push): senza
// una guardia suonerebbero due sirene sovrapposte per lo stesso avviso.
let lastUrgentSirenAt = 0
function triggerUrgentSiren() {
  const now = Date.now()
  if (now - lastUrgentSirenAt < 4000) return
  lastUrgentSirenAt = now
  playUrgentSignal()
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

function MenuPanel({ type, user, hotel, onSavePin, onSaveProfile, uiSize, onUiSizeChange }) {
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [feedback, setFeedback] = useState('')
  const [message, setMessage] = useState('')
  const [savingPin, setSavingPin] = useState(false)
  const [profileDraft, setProfileDraft] = useState({ email: user?.email || '', phone: user?.phone || '' })
  const [savingProfile, setSavingProfile] = useState(false)
  const [pushState, setPushState] = useState('checking')
  const [sound, setSound] = useState(() => getNotifSound().id)
  const chooseSound = (soundOption) => { setSound(soundOption.id); setNotifSound(soundOption.id); if (soundOption.file) new Audio(soundOption.file).play().catch(() => {}) }
  useEffect(() => {
    if (type !== 'Il mio profilo') return
    let active = true
    getPushSubscriptionState().then((state) => { if (active) setPushState(state) }).catch(() => { if (active) setPushState('unsupported') })
    return () => { active = false }
  }, [type])
  const savePin = async (event) => {
    event.preventDefault()
    if (!/^\d{4}$/.test(currentPin) || !/^\d{4}$/.test(newPin)) return
    setSavingPin(true); setMessage('')
    try {
      await onSavePin(currentPin, newPin)
      setMessage('PIN aggiornato'); setCurrentPin(''); setNewPin('')
    } catch (error) {
      setMessage(error?.message || 'Impossibile aggiornare il PIN')
    } finally { setSavingPin(false) }
  }
  const saveProfile = async (event) => {
    event.preventDefault()
    setSavingProfile(true); setMessage('')
    try {
      await onSaveProfile({ email: profileDraft.email.trim() || null, phone: profileDraft.phone.trim() || null })
      setMessage('Profilo aggiornato')
    } catch (error) {
      setMessage(error?.message || 'Impossibile aggiornare il profilo')
    } finally { setSavingProfile(false) }
  }
  const [savingFeedback, setSavingFeedback] = useState(false)
  const saveFeedback = async (event) => {
    event.preventDefault()
    const text = feedback.trim()
    if (!text) return
    setSavingFeedback(true); setMessage('')
    try {
      await insertFeedback(hotel.id, user.name, text)
      setFeedback(''); setMessage('Feedback inviato')
    } catch (error) {
      setMessage(error?.message || 'Invio non riuscito, riprova')
    } finally { setSavingFeedback(false) }
  }
  const toggleNotifications = async () => {
    setMessage('')
    try {
      if (pushState === 'subscribed') {
        await unsubscribeFromPush(hotel.id)
        setPushState('not-subscribed'); setMessage('Notifiche disattivate')
      } else {
        await subscribeToPush(hotel.id)
        setPushState('subscribed'); setMessage('Notifiche attivate su questo dispositivo')
      }
    } catch (error) {
      setMessage(error?.message || 'Impossibile attivare le notifiche')
    }
  }
  return <section className="settings-page">
      {type === 'Il mio profilo' && <><form onSubmit={saveProfile}><label>Nome<input aria-label="Nome" value={user?.name || ''} disabled readOnly title="Il nome non è modificabile: contatta un admin per cambiarlo" /></label><label>Email<input aria-label="Email" type="email" value={profileDraft.email} onChange={(event) => setProfileDraft({ ...profileDraft, email: event.target.value })} /></label><label>Numero di cellulare<input aria-label="Numero di cellulare" value={profileDraft.phone} onChange={(event) => setProfileDraft({ ...profileDraft, phone: event.target.value })} /></label><button className="primary" disabled={savingProfile}>{savingProfile ? 'Salvo…' : 'Salva profilo'}</button></form><div className="panel-content profile-notif-section"><strong>Notifiche</strong><p>Ricevi un avviso sul dispositivo quando arriva un avviso urgente.</p>{pushState === 'unsupported' ? <p className="notice">Le notifiche non sono supportate su questo dispositivo/browser.</p> : pushState === 'denied' ? <p className="notice">Permesso negato dal browser: abilita le notifiche per questo sito nelle impostazioni del dispositivo.</p> : <button className="primary" disabled={pushState === 'checking'} onClick={toggleNotifications}>{pushState === 'subscribed' ? 'Disattiva notifiche' : 'Attiva notifiche'}</button>}<div className="notif-sound-picker"><strong>Suono notifica</strong><small>Tocca per ascoltare l'anteprima</small><div className="notif-sound-choices">{SOUNDS.map((option) => <button type="button" key={option.id} className={sound === option.id ? 'active' : ''} onClick={() => chooseSound(option)}>{option.label}</button>)}</div><p className="notif-sound-note">Il suono scelto si sente quando arriva una segnalazione o un avviso urgente con l'app aperta. Ad app chiusa la notifica arriva con il suono di sistema del telefono.</p></div></div><fieldset className="ui-scale-setting profile-ui-scale"><legend>Dimensione interfaccia</legend><div>{[['small','Piccola'],['normal','Normale'],['large','Grande']].map(([value,label])=><button type="button" className={uiSize===value?'active':''} aria-pressed={uiSize===value} onClick={()=>onUiSizeChange(value)} key={value}>{label}</button>)}</div><small>Ingrandisce testi, pulsanti e schede.</small></fieldset></>}
      {type === 'Cambia PIN' && <form onSubmit={savePin}><label>PIN attuale<input aria-label="PIN attuale" inputMode="numeric" autoComplete="current-password" maxLength="4" value={currentPin} onChange={(event) => setCurrentPin(event.target.value.replace(/\D/g, '').slice(0, 4))} /></label><label>Nuovo PIN di 4 cifre<input aria-label="Nuovo PIN" inputMode="numeric" autoComplete="new-password" maxLength="4" value={newPin} onChange={(event) => setNewPin(event.target.value.replace(/\D/g, '').slice(0, 4))} /></label><button className="primary" disabled={currentPin.length !== 4 || newPin.length !== 4 || savingPin}>{savingPin ? 'Salvo…' : 'Salva PIN'}</button></form>}
      {type === 'Manuale' && <div className="manual-list"><article><strong>1. Segnalazioni</strong><span>Apri una richiesta, controlla camera, problema e gravità.</span></article><article><strong>2. Aggiorna lo stato</strong><span>Richiedi un tecnico o un pezzo quando il lavoro non può essere concluso.</span></article><article><strong>3. Completa</strong><span>Aggiungi foto e note prima di segnare la riparazione completata.</span></article></div>}
      {type === 'Feedback' && <form onSubmit={saveFeedback}><label>Scrivi un suggerimento<textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} rows="5" /></label><button className="primary" disabled={!feedback.trim() || savingFeedback}>{savingFeedback ? 'Invio…' : 'Invia feedback'}</button></form>}
      {message && <p className="menu-panel-message" role="status">{message}</p>}
  </section>
}

function UrgentSection({ hotel, user, users, items, openRequest, onCreate, onTake, onComplete, onTransform }) {
  const [filter, setFilter] = useState('tutte')
  const [creating, setCreating] = useState(false)
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const canTake = canManageUrgent(user)
  const presentMaintainers = (users || []).filter((person) => person.role === 'manutentore' && person.in_struttura)
  useEffect(() => { if (openRequest) setCreating(true) }, [openRequest])
  const hotelItems = items.filter((item) => item.hotelId === hotel.id)
  const counts = hotelItems.reduce((acc, item) => ({ ...acc, [item.status]: (acc[item.status] || 0) + 1 }), {})
  const filtered = hotelItems.filter((item) => filter === 'tutte' || (filter === 'attesa' && item.status === 'aperta') || (filter === 'lavorazione' && item.status === 'presa_in_carico') || (filter === 'fatte' && item.status === 'completata'))
  const send = async (event) => {
    event.preventDefault()
    const text = note.trim()
    if (!text) return
    setSending(true); setSendError('')
    try {
      await onCreate(text)
      setNote(''); setCreating(false); setFilter('attesa')
    } catch (error) {
      setSendError(error?.message || 'Invio non riuscito, riprova')
    } finally {
      setSending(false)
    }
  }
  const take = (id) => { onTake(id); setFilter('lavorazione') }
  const complete = (id) => { onComplete(id); setFilter('fatte') }
  const filters = [['tutte', 'Tutte', hotelItems.length], ['attesa', 'In attesa', counts.aperta || 0], ['lavorazione', 'In lavorazione', counts.presa_in_carico || 0], ['fatte', 'Fatte', counts.completata || 0]]
  return <section className="urgent-section"><div className="urgent-heading"><div><h2>Avvisi Urgenti</h2><p>Richieste immediate alla squadra manutenzione.</p></div></div><div className="urgent-presence"><strong>{presentMaintainers.length ? `In struttura ora: ${presentMaintainers.map((person) => person.name).join(', ')}` : 'Nessun manutentore risulta in struttura al momento'}</strong></div>{creating && <form className="urgent-form" onSubmit={send}><label>Che cosa serve con urgenza?<textarea autoFocus rows="3" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Esempio: serve subito assistenza in camera 206" /></label>{sendError && <p className="notice">{sendError}</p>}<div><button type="button" className="secondary" onClick={() => { setCreating(false); setNote(''); setSendError('') }}>Annulla</button><button className="urgent-send" disabled={!note.trim() || sending}>{sending ? 'Invio…' : 'Invia avviso urgente'}</button></div></form>}<div className="urgent-filters">{filters.map(([key, label, count]) => <button key={key} className={filter === key ? 'active' : key === 'attesa' && count ? 'attention' : ''} onClick={() => setFilter(key)}>{label} <span>{count}</span></button>)}</div><div className="urgent-list">{filtered.length ? filtered.map((item) => { const working = item.status === 'presa_in_carico', done = item.status === 'completata'; return <article className={`urgent-card ${done ? 'done' : working ? 'working' : 'open'}`} key={item.id}><strong className="urgent-state">{done ? 'Gestita' : working ? 'In corso' : 'Richiesta urgente'}</strong><small>Da {item.createdBy} · {new Date(item.createdAt).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</small><p>{item.note}</p>{done ? <div className="urgent-result">{item.transformed ? 'Trasformata in segnalazione' : `Fatto da ${item.completedBy || item.takenBy}`}</div> : working ? <><div className="urgent-result">{item.takenBy} sta andando</div>{canTake && <button className="urgent-primary" onClick={() => complete(item.id)}>Fatto</button>}{canTake && <button className="urgent-secondary" onClick={() => onTransform(item)}>Non risolvibile — trasforma in segnalazione</button>}</> : canTake ? <><button className="urgent-primary" onClick={() => take(item.id)}>Vado</button><button className="urgent-secondary" onClick={() => onTransform(item)}>Non risolvibile — trasforma in segnalazione</button></> : <div className="urgent-result">In attesa che un manutentore la prenda in carico</div>}</article> }) : <div className="urgent-empty"><strong>Nessuna richiesta urgente</strong><span>Gli avvisi della struttura compariranno qui.</span></div>}</div></section>
}

function UrgentBanner({ items, onOpen, onTake, onComplete, onTransform }) { if (!items.length) return null; return <section className="urgent-banner" aria-live="assertive"><button className="urgent-banner-title" onClick={onOpen}>🚨 {items.length === 1 ? 'Avviso urgente' : `${items.length} avvisi urgenti`}</button>{items.slice(0, 2).map((item) => <article key={item.id}><div><strong>{item.note}</strong><small>{item.status === 'presa_in_carico' ? `${item.takenBy} sta andando` : `Da ${item.createdBy}`}</small></div><div>{item.status === 'aperta' ? <button onClick={() => onTake(item.id)}>Vado</button> : <button onClick={() => onComplete(item.id)}>Fatto</button>}<button onClick={() => onTransform(item)}>Trasforma</button></div></article>)}</section> }

function UrgentTransformModal({ urgent, hotel, onClose, onSave }) {
  const catalog = HOTEL_LOCATIONS[hotel.id]
  const [mode, setMode] = useState('camera')
  const [draft, setDraft] = useState({ location: '', category: '', urgency: '', note: urgent.note })
  const validLocation = mode === 'camera' ? catalog.roomGroups.some((group) => group.rooms.includes(draft.location.trim())) : catalog.zones.some((zone) => zone.name === draft.location.trim())
  const valid = validLocation && draft.category && draft.urgency && draft.note.trim()
  return <div className="urgent-transform-backdrop" onClick={onClose}><form className="urgent-transform" role="dialog" aria-modal="true" aria-labelledby="urgent-transform-title" onClick={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); if (valid) onSave({ ...draft, mode }) }}><header><div><h2 id="urgent-transform-title">Trasforma in segnalazione</h2><p>Completa i dati mancanti prima di inviare.</p></div><button type="button" className="panel-close" onClick={onClose} aria-label="Chiudi"><Icon name="close" /></button></header><label>Camera o zona<LocationAutocomplete catalog={catalog} mode={mode} onModeChange={setMode} value={draft.location} onChange={(location) => setDraft({ ...draft, location })} />{draft.location && !validLocation && <small className="field-error">Scegli una posizione riconosciuta.</small>}</label><fieldset className="choice-field"><legend>Categoria obbligatoria</legend><div className="category-choices">{ISSUE_CATEGORIES.map((item) => <button type="button" key={item} className={draft.category === item ? 'active' : ''} onClick={() => setDraft({ ...draft, category: item })}>{item}</button>)}</div></fieldset><fieldset className="choice-field"><legend>Gravità obbligatoria</legend><div className="urgency-choices">{[['alta','Alta'],['media','Media'],['bassa','Bassa']].map(([key,label]) => <button type="button" key={key} className={draft.urgency === key ? `active ${key}` : ''} onClick={() => setDraft({ ...draft, urgency: key })}>{label}</button>)}</div></fieldset><label>Note<textarea required rows="4" value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} /></label><div className="form-actions"><button type="button" className="secondary" onClick={onClose}>Annulla</button><button className="primary" disabled={!valid}>Crea segnalazione</button></div></form></div>
}

function HotelMark({ hotel, large = false }) { return <span className={`hotel-mark ${hotel.tone} ${large ? 'large' : ''}`}>{hotel.mark}</span> }

function Home({ onSelect, onAdmin }) {
  const sliderRef = useRef(null), cardRefs = useRef([]), [activeIndex, setActiveIndex] = useState(1)
  const orderedHotels = ['chocohotel', 'hotelgio', 'brigantino'].map((id) => HOTELS.find((hotel) => hotel.id === id))
  const centerCard = (index, behavior = 'smooth') => { cardRefs.current[index]?.scrollIntoView({ behavior, inline: 'center', block: 'nearest' }); setActiveIndex(index) }
  useEffect(() => { if (window.matchMedia('(max-width: 700px)').matches) { const timer = window.setTimeout(() => centerCard(1, 'auto'), 50); return () => window.clearTimeout(timer) } }, [])
  useEffect(() => { const slider = sliderRef.current; if (!slider) return undefined; let timer; const onScroll = () => { if (!window.matchMedia('(max-width: 700px)').matches) return; window.clearTimeout(timer); timer = window.setTimeout(() => { const sliderRect = slider.getBoundingClientRect(); const center = sliderRect.left + sliderRect.width / 2; const closest = cardRefs.current.reduce((best, card, index) => { if (!card) return best; const rect = card.getBoundingClientRect(); const distance = Math.abs(center - (rect.left + rect.width / 2)); return distance < best.distance ? { index, distance } : best }, { index: 1, distance: Number.POSITIVE_INFINITY }); setActiveIndex(closest.index) }, 80) }; slider.addEventListener('scroll', onScroll, { passive: true }); return () => { slider.removeEventListener('scroll', onScroll); window.clearTimeout(timer) } }, [])
  return <div className="page home-page"><header className="home-header"><button className="home-admin" onClick={onAdmin}><Icon name="user" /> Admin</button></header><main className="home-content"><section className="home-brand-hero"><img className="home-mascot" src="/logos/apicehotel-mascot.png" alt="" /><strong className="home-brand-title">APICEHOTEL</strong><span className="home-brand-tagline">RandApp Manutenzione</span></section><section className="home-intro"><h1>Seleziona una struttura</h1><p>Scegli la struttura per accedere all’area riservata</p></section><section className="hotel-slider" ref={sliderRef} aria-label="Seleziona una struttura">{orderedHotels.map((hotel, index) => <button className={`showcase-card ${hotel.id} ${activeIndex === index ? 'active' : ''}`} key={hotel.id} ref={(node) => { cardRefs.current[index] = node }} onClick={() => onSelect(hotel)} type="button"><img className="hotel-card-img" src={hotel.card} alt={hotel.name} /></button>)}</section><div className="slider-dots" aria-label="Navigazione strutture">{orderedHotels.map((hotel, index) => <button key={hotel.id} className={`dot ${activeIndex === index ? 'active' : ''}`} onClick={() => centerCard(index)} aria-label={`Mostra ${hotel.name}`} aria-current={activeIndex === index ? 'true' : undefined} />)}</div><p className="mobile-help">Scorri per scegliere la struttura<br />e accedi con le tue credenziali</p></main></div>
}

function HotelArtwork({ hotel, className = '' }) { return <span className={`hotel-artwork ${hotel.id} ${className}`}><img className="hotel-card-img" src={hotel.card} alt={`Logo ${hotel.name}`} /></span> }

function Login({ hotel, users, usersLoading, onBack, onLogin }) {
  const allowed = users.filter((user) => !Array.isArray(user.hotels) || user.hotels.includes(hotel.id))
  const suggestRef = useRef(null)
  const [query, setQuery] = useState(''), [suggestOpen, setSuggestOpen] = useState(false), [matchedUser, setMatchedUser] = useState(null), [pin, setPin] = useState(''), [error, setError] = useState(''), [submitting, setSubmitting] = useState(false)
  useEffect(() => { const onClickOutside = (event) => { if (suggestRef.current && !suggestRef.current.contains(event.target)) setSuggestOpen(false) }; document.addEventListener('mousedown', onClickOutside); return () => document.removeEventListener('mousedown', onClickOutside) }, [])
  const trimmedQuery = query.trim().toLowerCase()
  const suggestions = trimmedQuery && !matchedUser ? allowed.filter((user) => user.name.toLowerCase().includes(trimmedQuery)).slice(0, 6) : []
  const pickUser = (user) => { setMatchedUser(user); setQuery(user.name); setSuggestOpen(false); setError('') }
  const onQueryChange = (value) => { setQuery(value); setSuggestOpen(true); if (matchedUser && value !== matchedUser.name) setMatchedUser(null) }
  const submit = async (event) => {
    event.preventDefault()
    if (!matchedUser || pin.length !== 4) return setError('Utente o PIN non validi')
    setSubmitting(true); setError('')
    try {
      const authSession = await loginWithPin({ hotelId: hotel.id, userId: matchedUser.legacy_id || matchedUser.id, pin })
      await onLogin(matchedUser, authSession)
    } catch { setError('Utente o PIN non validi') } finally { setSubmitting(false) }
  }
  return <div className="page login-page"><button className="back-link" onClick={onBack}>‹ Cambia struttura</button><main className="login-panel"><HotelArtwork hotel={hotel} className="login-hotel-art" /><h1>{hotel.name}</h1><form onSubmit={submit}><label>Il tuo nome<div className="location-autocomplete" ref={suggestRef}><input value={query} onChange={(event) => onQueryChange(event.target.value)} onFocus={() => setSuggestOpen(true)} placeholder={usersLoading ? 'Carico gli utenti…' : 'Scrivi il tuo nome'} autoComplete="off" disabled={usersLoading} />{suggestOpen && suggestions.length > 0 && <div className="location-suggestions">{suggestions.map((user) => <button key={user.id} type="button" onClick={() => pickUser(user)}>{user.name} <small style={{ opacity: .6 }}>· {user.role}</small></button>)}</div>}{suggestOpen && !usersLoading && allowed.length === 0 && <div className="location-suggestions"><span style={{ display: 'block', padding: '10px 13px', color: '#8a8a85' }}>Nessun utente configurato per questa struttura.</span></div>}{suggestOpen && !usersLoading && allowed.length > 0 && trimmedQuery && suggestions.length === 0 && <div className="location-suggestions"><span style={{ display: 'block', padding: '10px 13px', color: '#8a8a85' }}>Nessun utente trovato</span></div>}</div></label><label>PIN di 4 cifre<input inputMode="numeric" autoComplete="current-password" maxLength="4" pattern="[0-9]{4}" value={pin} onChange={(event) => { setPin(event.target.value.replace(/\D/g, '').slice(0, 4)); setError('') }} placeholder="••••" disabled={!matchedUser || submitting} /></label>{error && <p className="error" role="alert">{error}</p>}<button className="primary" disabled={!matchedUser || pin.length !== 4 || submitting}>{submitting ? 'Accesso…' : 'Accedi'}</button></form><aside className="session-note"><strong>Sessione persistente</strong><span>Il PIN non verrà richiesto di nuovo fino a logout, cambio utente o revoca.</span></aside></main></div>
}

function AdminGate({ onBack, onSuccess }) {
  const [pin, setPin] = useState(''), [error, setError] = useState(''), [checking, setChecking] = useState(false)
  const submit = async (event) => { event.preventDefault(); setChecking(true); setError(''); try { await loginAdmin(pin); await onSuccess() } catch { setError('PIN Admin non valido') } finally { setChecking(false) } }
  return <div className="page login-page admin-gate-page"><button className="back-link" onClick={onBack}>‹ Torna alla scelta struttura</button><main className="login-panel admin-gate"><span className="admin-lock"><Icon name="user" /></span><h1>Accesso Admin</h1><p>Inserisci il PIN amministratore di 6 cifre.</p><form onSubmit={submit}><label>PIN Admin<input aria-label="PIN Admin" inputMode="numeric" autoComplete="current-password" maxLength="6" pattern="[0-9]{6}" value={pin} onChange={(e)=>{setPin(e.target.value.replace(/\D/g,'').slice(0,6));setError('')}} placeholder="••••••" /></label>{error&&<p className="error" role="alert">{error}</p>}<button className="primary" disabled={pin.length!==6||checking}>{checking?'Verifico…':'Accedi al pannello'}</button></form></main></div>
}

function AdminPanel({ users, onReload, onClose }) {
  const initial = { name: '', role: 'segnalatore', department: 'Reception', email: '', phone: '', phone_country_code: '+39', pin: '', hotels: [...ALL_HOTEL_IDS], can_access_admin: false }
  const [creating, setCreating] = useState(false), [message, setMessage] = useState(''), [draft, setDraft] = useState(initial)
  const [editingId, setEditingId] = useState(null), [editDraft, setEditDraft] = useState({ name: '', email: '', phone: '' })
  const [rolesOpen, setRolesOpen] = useState(false)
  const [openRoleGroups, setOpenRoleGroups] = useState({})
  const toggleRoleGroup = (role) => setOpenRoleGroups((current) => ({ ...current, [role]: current[role] === false ? true : false }))
  const renderUserRow = (target) => <tr key={target.id}><td className="admin-user-name">{editingId===target.id?<div className="user-edit-form"><input aria-label={`Nome di ${target.name}`} value={editDraft.name} onChange={(e)=>setEditDraft({...editDraft,name:e.target.value})} placeholder="Nome" /><input aria-label={`Email di ${target.name}`} type="email" value={editDraft.email} onChange={(e)=>setEditDraft({...editDraft,email:e.target.value})} placeholder="Email" /><input aria-label={`Telefono di ${target.name}`} value={editDraft.phone} onChange={(e)=>setEditDraft({...editDraft,phone:e.target.value})} placeholder="Telefono" /><div className="user-edit-actions"><button className="primary" onClick={()=>saveEdit(target)}>Salva</button><button onClick={()=>setEditingId(null)}>Annulla</button></div></div>:<><strong>{target.name}</strong>{target.protected&&<small>Account protetto</small>}{!target.active&&<small className="user-inactive-label">Disattivato</small>}{(target.email||target.phone)&&<small>{[target.email,target.phone].filter(Boolean).join(' · ')}</small>}</>}</td><td data-label="Ruolo"><select aria-label={`Ruolo di ${target.name}`} value={target.role} disabled={target.protected} onChange={(e)=>saveChange(target,{role:e.target.value})}>{ROLES.map((role)=><option key={role}>{role}</option>)}</select></td><td data-label="Reparto">{target.role==='segnalatore'?<select aria-label={`Reparto di ${target.name}`} value={target.department||DEPARTMENTS[0]} onChange={(e)=>saveChange(target,{department:e.target.value})}>{DEPARTMENTS.map((item)=><option key={item}>{item}</option>)}</select>:<span>—</span>}</td>{HOTELS.map((hotel)=><td data-label={hotel.short} key={hotel.id}><input type="checkbox" checked={target.hotels.includes(hotel.id)} disabled={target.protected} onChange={()=>toggleHotel(target,hotel.id)} aria-label={`${target.name}: ${hotel.name}`}/></td>)}<td className="admin-user-actions"><button onClick={()=>startEdit(target)}>Modifica</button><button onClick={()=>resetPin(target)} disabled={target.protected}>PIN</button>{target.role === 'Tecnico esterno' && <button onClick={()=>showTechnicianLink(target)}>Link</button>}{target.active?<button className="delete-user" onClick={()=>deactivate(target)} disabled={target.protected}>Disattiva</button>:<button className="activate-user" onClick={()=>activate(target)}>Attiva</button>}<button className="delete-user" onClick={()=>remove(target)} disabled={target.protected}>Elimina</button></td></tr>
  const roleGroups = [...ROLES.map((role) => ({ role, list: users.filter((target) => target.role === role) })).filter((group) => group.list.length), ...(users.some((target) => !ROLES.includes(target.role)) ? [{ role: 'Altro', list: users.filter((target) => !ROLES.includes(target.role)) }] : [])]
  const [techLink, setTechLink] = useState(null)
  const showTechnicianLink = async (target, regenerate) => {
    try {
      const token = await getTechnicianLink(target.id, regenerate)
      const url = `${window.location.origin}/tecnico/${token}`
      setTechLink({ id: target.id, name: target.name, phone: target.phone, url })
    } catch (error) { setMessage(error?.message || 'Errore nel generare il link') }
  }
  const saveChange = async (target, changes) => { if (target.protected && ('role' in changes || 'hotels' in changes || 'can_access_admin' in changes)) return setMessage('Account protetto: questi campi non sono modificabili'); try { await updateUserRow(target.id, changes); await onReload(); setMessage('Modifiche salvate') } catch (error) { setMessage(error?.message || 'Errore durante il salvataggio') } }
  const startEdit = (target) => { setEditingId(target.id); setEditDraft({ name: target.name || '', email: target.email || '', phone: target.phone || '' }) }
  const saveEdit = async (target) => { if (!editDraft.name.trim()) return setMessage('Il nome non può essere vuoto'); await saveChange(target, { name: editDraft.name.trim(), email: editDraft.email.trim() || null, phone: editDraft.phone.trim() || null }); setEditingId(null) }
  const toggleHotel = async (target, hotelId) => { const hotels = target.hotels.includes(hotelId) ? target.hotels.filter((id) => id !== hotelId) : [...target.hotels, hotelId]; if (!hotels.length) return setMessage('Ogni utente deve mantenere almeno una struttura'); await saveChange(target, { hotels }) }
  const create = async (event) => { event.preventDefault(); if (!draft.name.trim() || !/^\d{4}$/.test(draft.pin) || !draft.hotels.length) return setMessage('Inserisci nome, PIN di 4 cifre e almeno una struttura'); try { await insertUser({ ...draft, name: draft.name.trim(), department: draft.role === 'segnalatore' ? draft.department : null }); await onReload(); setDraft(initial); setCreating(false); setMessage(`${draft.name.trim()} aggiunto`) } catch (error) { setMessage(error?.message || 'Errore durante la creazione') } }
  const deactivate = async (target) => { if (target.protected) return setMessage('Gli account protetti non possono essere disattivati'); if (!window.confirm(`Disattivare ${target.name}?`)) return; try { await setUserActive(target.id, false); await onReload(); setMessage(`${target.name} disattivato`) } catch (error) { setMessage(error?.message || 'Errore durante la disattivazione') } }
  const activate = async (target) => { try { await setUserActive(target.id, true); await onReload(); setMessage(`${target.name} riattivato`) } catch (error) { setMessage(error?.message || 'Errore durante la riattivazione') } }
  const remove = async (target) => { if (target.protected) return setMessage('Gli account protetti non possono essere eliminati'); if (!window.confirm(`Eliminare DEFINITIVAMENTE ${target.name}? L'account, il PIN e l'accesso non saranno più recuperabili. Le segnalazioni/interventi già registrati restano (con il nome salvato), ma non saranno più collegati a un account attivo. Questa azione non è reversibile.`)) return; try { await permanentlyDeleteUser(target.id); await onReload(); setMessage(`${target.name} eliminato definitivamente`) } catch (error) { setMessage(error?.message || 'Errore durante l’eliminazione') } }
  const resetPin = async (target) => { if (target.protected) return setMessage('Il PIN dell’account protetto va gestito dal flusso dedicato'); const pin = window.prompt(`Nuovo PIN di 4 cifre per ${target.name}`) || ''; if (!/^\d{4}$/.test(pin)) return setMessage('PIN non valido'); try { await updateUserPin(target.id, pin); setMessage(`PIN di ${target.name} aggiornato`) } catch (error) { setMessage(error?.message || 'Errore durante il cambio PIN') } }
  return <section className="admin-panel"><div className="admin-heading"><div><button className="back-link" onClick={onClose}>‹ Torna alla Home</button><h1>Pannello admin</h1><p>Gestisci utenti, ruoli e accessi alle strutture.</p></div><div className="admin-actions"><button className="primary add-user" onClick={() => setCreating(!creating)}>{creating ? 'Annulla' : '+ Nuovo utente'}</button></div></div>{creating && <form className="user-form" onSubmit={create}><label>Nome<input value={draft.name} onChange={(e) => setDraft({...draft,name:e.target.value})} placeholder="Nome utente" /></label><label>Ruolo<select value={draft.role} onChange={(e) => setDraft({...draft,role:e.target.value})}>{ROLES.map((role)=><option key={role}>{role}</option>)}</select></label>{draft.role === 'segnalatore' && <label>Reparto<select value={draft.department} onChange={(e)=>setDraft({...draft,department:e.target.value})}>{DEPARTMENTS.map((item)=><option key={item}>{item}</option>)}</select></label>}<label>Email<input type="email" value={draft.email} onChange={(e)=>setDraft({...draft,email:e.target.value})} /></label><label>Telefono<input value={draft.phone} onChange={(e)=>setDraft({...draft,phone:e.target.value})} /></label><label>PIN di 4 cifre<input inputMode="numeric" maxLength="4" value={draft.pin} onChange={(e)=>setDraft({...draft,pin:e.target.value.replace(/\D/g,'').slice(0,4)})} placeholder="••••" /></label><fieldset><legend>Strutture abilitate</legend>{HOTELS.map((hotel)=><label className="hotel-check" key={hotel.id}><input type="checkbox" checked={draft.hotels.includes(hotel.id)} onChange={()=>setDraft({...draft,hotels:draft.hotels.includes(hotel.id)?draft.hotels.filter((id)=>id!==hotel.id):[...draft.hotels,hotel.id]})}/>{hotel.name}</label>)}</fieldset><button className="primary">Salva utente</button></form>}{message && <p className="admin-message" role="status">{message}</p>}<section className="permission-matrix" aria-label="Permessi per ruolo"><button type="button" className={`permission-matrix-toggle ${rolesOpen ? 'active' : ''}`} onClick={() => setRolesOpen(!rolesOpen)} aria-expanded={rolesOpen}><h2>Ruoli e permessi</h2><Icon name="chevron" /></button>{rolesOpen && <><div>{ROLES.map((role) => <article key={role}><strong>{role}</strong><span>{(ROLE_PERMISSIONS[role] || []).map((permission) => PERMISSION_LABELS[permission] || permission).join(' · ')}</span></article>)}</div><p>Planning lavori e Planning Sale sono visibili nel menu solo a Manutentore e Direttore Centro Congressi. Planning Sale è disponibile solo presso Hotel Giò.</p></>}</section><div className="admin-role-groups">{roleGroups.map(({ role, list }) => <div className="admin-role-group" key={role}><button type="button" className={`role-group-toggle ${openRoleGroups[role] === false ? '' : 'active'}`} onClick={() => toggleRoleGroup(role)} aria-expanded={openRoleGroups[role] !== false}><strong>{role}</strong><span className="role-group-count">{list.length}</span><Icon name="chevron" /></button>{openRoleGroups[role] !== false && <table><thead><tr><th>Utente</th><th>Ruolo</th><th>Reparto</th>{HOTELS.map((hotel)=><th key={hotel.id}>{hotel.short}</th>)}<th /></tr></thead><tbody>{list.map((target) => renderUserRow(target))}</tbody></table>}</div>)}</div><SensorsPanel /><p className="admin-footnote">Le modifiche sono operative sul database condiviso di tutte le strutture.</p>{techLink && <div className="sheet-overlay" onClick={() => setTechLink(null)}><div className="sheet" onClick={(event) => event.stopPropagation()}><div className="sheet-head"><button className="back-link" onClick={() => setTechLink(null)}>‹ Chiudi</button></div><h2 className="detail-room">Link accesso di {techLink.name}</h2><p className="piece-decision-note">Chi apre questo link vede solo i lavori assegnati a {techLink.name}, senza bisogno di PIN. Non condividerlo con nessun altro.</p><label>URL personale<input readOnly value={techLink.url} onFocus={(event) => event.target.select()} /></label><div className="inline-form-actions"><button className="secondary" onClick={() => { navigator.clipboard?.writeText(techLink.url); setMessage('Link copiato') }}>Copia link</button>{whatsappLink(techLink.phone) && <a className="primary" style={{textAlign:'center'}} href={`${whatsappLink(techLink.phone)}?text=${encodeURIComponent(`Ciao ${techLink.name}, ecco il tuo link personale per i lavori assegnati: ${techLink.url}`)}`} target="_blank" rel="noopener noreferrer">Invia su WhatsApp</a>}</div><button className="secondary" style={{marginTop:8}} onClick={() => showTechnicianLink({ id: techLink.id, name: techLink.name, phone: techLink.phone }, true)}>Rigenera link (invalida il precedente)</button></div></div>}</section>
}

function LocationAutocomplete({ catalog, mode, onModeChange, value, onChange }) {
  const [open, setOpen] = useState(false), wrapRef = useRef(null)
  const rooms = useMemo(() => catalog.roomGroups.flatMap((group) => group.rooms), [catalog])
  const query = value.trim().toLowerCase()
  const suggestions = query ? (mode === 'camera' ? rooms.filter((room) => room.toLowerCase().startsWith(query)) : catalog.zones.filter((zone) => [zone.name, ...zone.aliases].some((item) => item.toLowerCase().includes(query))).map((zone) => zone.name)).slice(0, 8) : []
  useEffect(() => { const close = (event) => { if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false) }; document.addEventListener('pointerdown', close); return () => document.removeEventListener('pointerdown', close) }, [])
  const changeMode = (nextMode) => { onModeChange(nextMode); onChange(''); setOpen(false) }
  return <div className="location-autocomplete" ref={wrapRef}><div className="location-modes">{[['camera','Camera'],['zona','Zona']].map(([key,label])=><button type="button" key={key} className={mode === key ? 'active' : ''} onClick={()=>changeMode(key)}>{label}</button>)}</div><input aria-label={mode === 'camera' ? 'Numero camera' : 'Cerca zona'} inputMode={mode === 'camera' ? 'numeric' : 'text'} pattern={mode === 'camera' ? '[0-9]*' : undefined} autoComplete="off" value={value} placeholder={mode === 'camera' ? 'Numero camera, es. 214' : 'Cerca zona, es. Hall'} onFocus={()=>setOpen(Boolean(query))} onChange={(event)=>{const next=mode === 'camera' ? event.target.value.replace(/[^0-9]/g,'') : event.target.value;onChange(next);setOpen(Boolean(next.trim()))}} />{open && suggestions.length > 0 && <div className="location-suggestions">{suggestions.map((item)=><button type="button" key={item} onPointerDown={(event)=>{event.preventDefault();event.stopPropagation();onChange(item);setOpen(false)}}>{item}</button>)}</div>}</div>
}

function readPhotoAsDataUrl(file) { return new Promise((resolve) => { if (!file) return resolve(null); const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => resolve(null); reader.readAsDataURL(file) }) }

const NewIssueForm = memo(function NewIssueForm({ hotel, user, onCancel, onSave }) {
  const catalog = HOTEL_LOCATIONS[hotel.id]
  const [locationMode, setLocationMode] = useState('camera')
  const [draft, setDraft] = useState({ location: '', title: '', urgency: 'media', category: 'Varie', photoName: '', photoData: null, roomStatus: null })
  const [saving, setSaving] = useState(false)
  const validLocation = locationMode === 'camera' ? catalog.roomGroups.some((group) => group.rooms.includes(draft.location.trim())) : catalog.zones.some((zone) => zone.name === draft.location.trim())
  const pickPhoto = async (file) => { const photoData = await readPhotoAsDataUrl(file); setDraft((current) => ({ ...current, photoName: file?.name || '', photoData })) }
  const submit = async (event) => { event.preventDefault(); if (!validLocation || !draft.title.trim()) return; setSaving(true); onSave({ id: Date.now(), hotelId: hotel.id, urgency: draft.urgency, room: (locationMode === 'camera' ? 'Camera' : 'Zona') + ' · ' + draft.location.trim(), title: draft.title.trim(), status: 'todo', date: 'Oggi, ' + new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }), createdAt: Date.now(), createdBy: user.id, createdByName: user.name, department: user.department || user.role, category: draft.category, origin: 'App', photoName: draft.photoName, photoData: draft.photoData, roomStatus: locationMode === 'camera' ? draft.roomStatus : null }) }
  return <form className="new-issue-form" onSubmit={submit}><div className="form-heading"><button type="button" className="form-back" onClick={onCancel} aria-label="Torna indietro">‹</button><div><h2>Nuova segnalazione</h2><p>{hotel.name} · stato iniziale Da fare</p></div></div><div className="issue-form-grid"><label className="location-field">Numero camera<LocationAutocomplete catalog={catalog} mode={locationMode} onModeChange={setLocationMode} value={draft.location} onChange={(location)=>setDraft({...draft,location})} />{draft.location && !validLocation && <small className="field-error">{locationMode === 'camera' ? 'Camera non presente nella struttura.' : 'Scegli una zona riconosciuta dai suggerimenti.'}</small>}</label>{locationMode === 'camera' && <fieldset className="choice-field room-status-field"><legend>Stato camera</legend><div className="room-status-choices">{ROOM_STATUS_OPTIONS.map(([key,label])=><button type="button" key={key} className={draft.roomStatus === key ? 'active' : ''} onClick={()=>setDraft({...draft,roomStatus:draft.roomStatus === key ? null : key})}>{label}</button>)}</div></fieldset>}<fieldset className="choice-field urgency-field"><legend>Urgenza</legend><div className="urgency-choices">{[['alta','Alta'],['media','Media'],['bassa','Bassa']].map(([key,label])=><button type="button" key={key} className={draft.urgency === key ? 'active ' + key : ''} onClick={()=>setDraft({...draft,urgency:key})}>{label}</button>)}</div></fieldset><fieldset className="choice-field category-field"><legend>Categoria</legend><div className="category-choices">{ISSUE_CATEGORIES.map((item)=><button type="button" key={item} className={draft.category === item ? 'active' : ''} onClick={()=>setDraft({...draft,category:item})}>{item}</button>)}</div></fieldset><label className="description-field">Descrizione del problema<textarea required rows="4" value={draft.title} onChange={(e)=>setDraft({...draft,title:e.target.value})} placeholder="Descrivi il problema in modo chiaro" /></label><fieldset className="choice-field photo-field"><legend>Foto</legend><div className="photo-actions"><label className="photo-action camera-action"><input className="photo-input camera-input" type="file" accept="image/*" capture="environment" onChange={(e)=>pickPhoto(e.target.files?.[0])} /><Icon name="camera" /><strong>Scatta foto</strong></label><label className="photo-action gallery-action"><input className="photo-input gallery-input" type="file" accept="image/*" onChange={(e)=>pickPhoto(e.target.files?.[0])} /><Icon name="image" /><strong>Scegli dalla galleria</strong></label></div>{draft.photoData && <img className="photo-preview" src={draft.photoData} alt="Anteprima foto selezionata" />}{draft.photoName && <small className="photo-selected">Selezionata: {draft.photoName}</small>}</fieldset></div><div className="form-actions"><button type="button" className="secondary cancel-issue" onClick={onCancel}>Annulla</button><button className="primary submit-issue" disabled={!validLocation || !draft.title.trim() || saving}>＋ Invia segnalazione</button></div></form>
})

function IssueDetail({ issue, permissions, currentUser, users, onClose, onUpdate, onDelete }) {
  const [noteDraft, setNoteDraft] = useState(''), [completionPhoto, setCompletionPhoto] = useState(null), [completionPhotoName, setCompletionPhotoName] = useState(''), [pieceDraft, setPieceDraft] = useState(''), [replacedDraft, setReplacedDraft] = useState(''), [askingPiece, setAskingPiece] = useState(false), [askingReplaced, setAskingReplaced] = useState(false), [photoPickerOpen, setPhotoPickerOpen] = useState(false), [askingTechnician, setAskingTechnician] = useState(false), [technicianChoice, setTechnicianChoice] = useState('')
  const canAct = issue.status === 'todo' && permissions.includes('complete')
  const externalTechnicians = users.filter((person) => person.role === 'Tecnico esterno')
  const confirmComplete = () => { onUpdate(issue.id, { status: 'done', completionNote: noteDraft.trim() || null, completionPhotoData: completionPhoto, completedBy: currentUser.name, completedAt: Date.now() }); onClose() }
  const pickCompletionPhoto = async (file) => { const data = await readPhotoAsDataUrl(file); setCompletionPhoto(data); setCompletionPhotoName(file?.name || ''); setPhotoPickerOpen(false) }
  const confirmPiece = () => { if (!pieceDraft.trim()) return; onUpdate(issue.id, { status: 'waiting', pieceName: pieceDraft.trim(), pieceWaitingSince: Date.now() }); onClose() }
  const pieceArrived = () => { onUpdate(issue.id, { status: 'todo', pieceArrivedAt: Date.now() }); onClose() }
  const savePieceDecision = (decision) => onUpdate(issue.id, { pieceDecision: decision, pieceDecisionBy: currentUser.name, pieceDecisionAt: Date.now() })
  const confirmReplaced = () => { if (!replacedDraft.trim()) return; onUpdate(issue.id, { pieceReplaced: replacedDraft.trim(), pieceReplacedBy: currentUser.name, pieceReplacedAt: Date.now() }); setAskingReplaced(false); setReplacedDraft('') }
  const confirmTechnician = () => {
    const tech = externalTechnicians.find((person) => person.id === technicianChoice)
    if (!tech) return
    onUpdate(issue.id, { status: 'tecnico', technicianRequestedAt: Date.now(), technicianRequestedBy: currentUser.name, technicianId: tech.id, technicianName: tech.name, technicianPhone: tech.phone || null })
    onClose()
  }
  const techDone = () => { onUpdate(issue.id, { status: 'done', completedBy: currentUser.name, completedAt: Date.now() }); onClose() }
  const remove = () => { if (window.confirm('Eliminare questa segnalazione? L’azione non è reversibile.')) { onDelete(issue.id); onClose() } }
  return <div className="sheet-overlay" onClick={onClose}><div className="sheet" onClick={(event) => event.stopPropagation()}><div className="sheet-head"><button className="back-link" onClick={onClose}>‹ Chiudi</button><div className="sheet-head-actions">{permissions.includes('assign') && <button className="delete-issue-compact" onClick={remove}>Elimina</button>}<span className={`urgency badge-${issue.urgency}`}>{issue.urgency}</span></div></div><h2 className="detail-room">{issue.room}</h2><section className="issue-summary"><p className="detail-section-label">Problema segnalato</p><p className="detail-description">{issue.title}</p><p className="detail-origin">Da {issue.origin || 'App'}{issue.createdByName ? ` · ${issue.createdByName}` : ''} · {issue.date}</p><dl className="detail-meta"><div><dt>Reparto</dt><dd>{issue.department}</dd></div><div><dt>Categoria</dt><dd>{issue.category}</dd></div>{issue.roomStatus && <div><dt>Stato camera</dt><dd>{ROOM_STATUS_OPTIONS.find(([key]) => key === issue.roomStatus)?.[1] || issue.roomStatus}</dd></div>}</dl></section>{issue.photoData && <img className="detail-photo" src={issue.photoData} alt={`Foto segnalazione: ${issue.title}`} />}{issue.status === 'tecnico' && <div className="status-note tech-requested">Tecnico esterno richiesto da <strong>{issue.technicianRequestedBy}</strong>{issue.technicianName && <> · assegnato a <strong>{issue.technicianName}</strong></>}{issue.technicianExpectedArrival && <p>Arrivo previsto: {new Date(issue.technicianExpectedArrival).toLocaleString('it-IT', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}</p>}</div>}{issue.status === 'waiting' && <div className="status-note waiting-piece">In attesa di: <strong>{issue.pieceName}</strong>{!issue.pieceDecision ? <div className="piece-decision-choices"><button type="button" onClick={() => savePieceDecision('ritiro')}>🚗 Lo vado a ritirare</button><button type="button" onClick={() => savePieceDecision('ordine')}>📦 Verrà ordinato</button></div> : <p className="piece-decision-note">{issue.pieceDecision === 'ritiro' ? '🚗 Da ritirare di persona' : '📦 In ordine'} · {issue.pieceDecisionBy}</p>}</div>}{issue.pieceReplaced && <div className="status-note piece-replaced">Pezzo sostituito: <strong>{issue.pieceReplaced}</strong><p>Da {issue.pieceReplacedBy}</p></div>}{issue.status === 'done' && <div className="status-note done">Completata da <strong>{issue.completedBy}</strong>{issue.completionNote && <p>{issue.completionNote}</p>}{issue.completionPhotoData && <img className="detail-photo" src={issue.completionPhotoData} alt="Foto riparazione completata" />}</div>}<div className="detail-actions action-panel">{canAct && !askingPiece && !askingReplaced && <><p className="detail-actions-heading">Azioni</p><div className="detail-action-pair"><button className="secondary action-needs-piece" onClick={() => setAskingPiece(true)}><Icon name="package" />Serve pezzo</button>{!issue.pieceReplaced && <button className="secondary action-replaced" onClick={() => setAskingReplaced(true)}><Icon name="package" />Pezzo sostituito</button>}</div><button className="secondary action-technician" onClick={() => setAskingTechnician(true)}><Icon name="message" />Chiedi un tecnico</button><div className="completion-fields"><p className="completion-fields-title">Riparazione completata</p><label>Foto (opzionale)<button type="button" className="photo-picker-trigger" onClick={() => setPhotoPickerOpen(!photoPickerOpen)} aria-expanded={photoPickerOpen}><Icon name="camera" /><span>{completionPhotoName ? 'Cambia foto' : 'Aggiungi foto'}</span><Icon name="chevron" /></button>{photoPickerOpen && <div className="photo-picker-options"><label><input className="photo-input" type="file" accept="image/*" capture="environment" onChange={(e) => pickCompletionPhoto(e.target.files?.[0])} /><Icon name="camera" /><strong>Scatta foto</strong></label><label><input className="photo-input" type="file" accept="image/*" onChange={(e) => pickCompletionPhoto(e.target.files?.[0])} /><Icon name="image" /><strong>Scegli dalla galleria</strong></label></div>}{completionPhoto && <img className="photo-preview" src={completionPhoto} alt="Anteprima foto completamento" />}{completionPhotoName && <small className="photo-selected">Selezionata: {completionPhotoName}</small>}</label><label>Note sul lavoro fatto (facoltative)<textarea rows="3" value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="Cosa è stato fatto" /></label></div><button className="primary complete-action" onClick={confirmComplete}><Icon name="check" />Riparazione completata</button></>}{issue.status === 'tecnico' && permissions.includes('complete') && <button className="primary" onClick={techDone}>Segna completata (tecnico)</button>}{askingReplaced && <div className="inline-form"><label>Cosa hai sostituito<input value={replacedDraft} onChange={(e) => setReplacedDraft(e.target.value)} placeholder="Es. Lampadina LED bagno" /></label><div className="inline-form-actions"><button className="secondary" onClick={() => setAskingReplaced(false)}>Annulla</button><button className="primary" disabled={!replacedDraft.trim()} onClick={confirmReplaced}>Registra sostituzione</button></div></div>}{askingPiece && <div className="inline-form"><label>Nome del pezzo in attesa<input value={pieceDraft} onChange={(e) => setPieceDraft(e.target.value)} placeholder="Es. Faretto LED esterno IP65" /></label><div className="inline-form-actions"><button className="secondary" onClick={() => setAskingPiece(false)}>Annulla</button><button className="primary" disabled={!pieceDraft.trim()} onClick={confirmPiece}>Conferma attesa pezzo</button></div></div>}{askingTechnician && <div className="inline-form"><label>Quale tecnico esterno?<select value={technicianChoice} onChange={(e) => setTechnicianChoice(e.target.value)}><option value="">Scegli...</option>{externalTechnicians.map((tech) => <option key={tech.id} value={tech.id}>{tech.name}</option>)}</select></label>{!externalTechnicians.length && <p className="piece-decision-note">Nessun Tecnico esterno configurato per questa struttura: aggiungine uno da Gestione utenti.</p>}<div className="inline-form-actions"><button className="secondary" onClick={() => setAskingTechnician(false)}>Annulla</button><button className="primary" disabled={!technicianChoice} onClick={confirmTechnician}>Conferma richiesta</button></div></div>}{issue.status === 'waiting' && permissions.includes('complete') && <button className="primary" onClick={pieceArrived}>Pezzo arrivato, torna in Da fare</button>}</div></div></div>
}

const canCreatePlanned = (user) => ['admin', 'Responsabile', 'Direzione', 'Direttore Centro Congressi'].includes(user.role) || user.department === 'Reception'
const canViewPlanned = (user) => canCreatePlanned(user) || ['manutentore','Tecnico esterno'].includes(user.role)
const canViewPlanningMenu = (user) => ['manutentore','Direttore Centro Congressi'].includes(user.role)
const canViewTemperature = (user) => ['Direzione','Direttore Centro Congressi','manutentore'].includes(user.role) || user.department === 'Reception'
const canViewHousekeeping = (user) => ['Direzione','Direttore Centro Congressi','Portiere Notturno'].includes(user.role) || ['Reception','Governante'].includes(user.department)
// Turno massimo di presenza: 7h20m, stessa costante usata lato server (pin-auth, user-pin).
const PRESENCE_MAX_MS = (7 * 60 + 20) * 60 * 1000
const isPresenceExpired = (since) => Boolean(since) && Date.now() - since > PRESENCE_MAX_MS
const toLocalDateTimeInput = (timestamp) => { const date = new Date(timestamp); const offset = date.getTimezoneOffset() * 60000; return new Date(date.getTime() - offset).toISOString().slice(0,16) }

function PlannedCard({ item, user, onOpen }) { const assigned = item.assignees?.some((person) => person.id === user.id); const doneRooms = Object.keys(item.roomsDone || {}).length; const progress = item.rooms?.length ? Math.round(doneRooms / item.rooms.length * 100) : 0; return <article className={`planned-card ${assigned ? 'assigned' : ''}`} onClick={onOpen} role="button" tabIndex={0}><div className="planned-accent" /><div className="planned-body"><div className="planned-location"><small>{item.locationMode === 'camera' ? 'CAM.' : 'ZONA'}</small><strong>{item.location}</strong></div><div className="planned-content"><div className="planned-badges"><span>{item.category}</span><span className={item.status}>{item.status === 'waiting' ? 'Attesa pezzo' : item.status === 'da_finire' ? 'Da finire' : item.status === 'done' ? 'Completato' : 'Pianificato'}</span>{assigned && <span className="you">Tu</span>}</div><p>{item.notes || 'Nessuna nota'}</p>{item.rooms?.length > 0 && <div className="room-progress"><i><b style={{width:`${progress}%`}} /></i><span>{doneRooms} di {item.rooms.length} camere · {progress}%</span></div>}<small>◷ Da {new Date(item.scheduledAt).toLocaleString('it-IT', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })} · A {new Date(item.scheduledUntil || item.scheduledAt).toLocaleString('it-IT', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</small>{item.technicianExpectedArrival && <small className="technician-eta">🚚 Arrivo tecnico previsto: {new Date(item.technicianExpectedArrival).toLocaleString('it-IT', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</small>}<div className="planned-assignees">{item.assignees?.map((person) => <span key={person.id}>👤 {person.name}</span>)}</div></div></div></article> }

function PlannedForm({ hotel, users, initial, onClose, onSave }) {
  const catalog = HOTEL_LOCATIONS[hotel.id], [mode, setMode] = useState(initial?.locationMode || 'camera'), [draft, setDraft] = useState(initial || { location:'', category:'Varie', notes:'', scheduledAt:'', scheduledUntil:'', assignees:[] }), [groupIds, setGroupIds] = useState(initial?.roomGroupIds || [])
  const candidates = users.filter((person) => person.hotels?.includes(hotel.id) && ['manutentore','Tecnico esterno'].includes(person.role)), isChecklist = ['Pulizia filtri','Idromassaggio','Extra Piani'].includes(draft.category), isMultiFloor = draft.category === 'Extra Piani', availableGroupEntries = catalog.roomGroups.map((group,index) => ({ group,index })).filter(({group}) => draft.category !== 'Idromassaggio' || (hotel.id === 'hotelgio' && group.name.startsWith('Jazz'))), selectedGroups = catalog.roomGroups.filter((_, index) => groupIds.includes(index)), checklistRooms = selectedGroups.flatMap((group) => draft.category === 'Idromassaggio' ? group.rooms.filter((room) => Number(room) % 2 === 0) : group.rooms), validLocation = isChecklist ? selectedGroups.length > 0 : mode === 'camera' ? catalog.roomGroups.some((group) => group.rooms.includes(draft.location.trim())) : draft.location.trim().length > 0, validPeriod = draft.scheduledAt && draft.scheduledUntil && new Date(draft.scheduledUntil) >= new Date(draft.scheduledAt), valid = validLocation && (isChecklist || draft.notes.trim()) && validPeriod && draft.assignees.length
  const pickGroup = (index) => setGroupIds((current) => isMultiFloor ? current.includes(index) ? current.filter((item) => item !== index) : [...current,index] : [index]), toggleAssignee = (person) => setDraft((current) => ({ ...current, assignees: current.assignees.some((item) => item.id === person.id) ? current.assignees.filter((item) => item.id !== person.id) : [...current.assignees, { id:person.id, name:person.name, role:person.role }] }))
  return <div className="urgent-transform-backdrop" onClick={onClose}><form className="planned-form" onClick={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); if (valid) onSave({ ...draft, location:isChecklist ? selectedGroups.map((group) => group.name).join(', ') : draft.location, locationMode:isChecklist ? 'zona' : mode, roomGroupIds:groupIds, rooms:isChecklist ? checklistRooms : null, roomsDone:draft.roomsDone || {} }) }}><header><div><h2>{initial ? 'Modifica intervento pianificato' : 'Nuovo intervento pianificato'}</h2><p>Compila tutti i campi obbligatori.</p></div><button type="button" className="panel-close" onClick={onClose}><Icon name="close" /></button></header>{!isChecklist && <label>Camera o zona *<LocationAutocomplete catalog={catalog} mode={mode} onModeChange={setMode} value={draft.location} onChange={(location) => setDraft({ ...draft, location })} />{draft.location && !validLocation && <small className="field-error">Camera o zona non valida.</small>}</label>}<fieldset className="choice-field"><legend>Categoria *</legend><div className="category-choices">{ISSUE_CATEGORIES.map((item) => <button type="button" key={item} className={draft.category === item ? 'active' : ''} onClick={() => { if(draft.category !== item) setGroupIds([]); setDraft({ ...draft, category:item }) }}>{item}</button>)}</div></fieldset>{isChecklist && <fieldset className="choice-field"><legend>{isMultiFloor ? 'Piani *' : 'Piano *'}</legend><div className="floor-choices">{availableGroupEntries.map(({group,index}) => <button type="button" key={group.name} className={groupIds.includes(index) ? 'active' : ''} onClick={() => pickGroup(index)}>{group.name}</button>)}</div>{checklistRooms.length > 0 && <small>{checklistRooms.length} camere da spuntare</small>}</fieldset>}<label>Descrizione *<textarea rows="4" value={draft.notes} onChange={(event) => setDraft({ ...draft, notes:event.target.value })} placeholder="Descrivi l’intervento..." /></label><fieldset className="choice-field"><legend>Periodo previsto *</legend><div className="planned-period"><label>Da<input type="datetime-local" value={draft.scheduledAt} onChange={(event) => setDraft({ ...draft, scheduledAt:event.target.value })} /></label><label>A<input type="datetime-local" value={draft.scheduledUntil} min={draft.scheduledAt} onChange={(event) => setDraft({ ...draft, scheduledUntil:event.target.value })} /></label></div>{draft.scheduledAt && draft.scheduledUntil && !validPeriod && <small className="field-error">La data “A” deve essere successiva alla data “Da”.</small>}</fieldset><fieldset className="choice-field"><legend>Assegna a *</legend><div className="assignee-choices">{candidates.map((person) => <button type="button" key={person.id} className={draft.assignees.some((item) => item.id === person.id) ? 'active' : ''} onClick={() => toggleAssignee(person)}>👤 <span>{person.name}<small>{person.role}</small></span></button>)}</div></fieldset><div className="form-actions"><button type="button" className="secondary" onClick={onClose}>Annulla</button><button className="planned-submit" disabled={!valid}>{initial ? 'Salva modifiche' : 'Pianifica intervento'}</button></div></form></div>
}

function PlannedDetail({ item, user, onClose, onUpdate, onDelete, onEdit, onCompleteToIssues }) {
  const [photo, setPhoto] = useState(null), canComplete = canViewPlanned(user), roomsDone = item.roomsDone || {}, formatDay = (timestamp) => new Date(timestamp).toLocaleDateString('it-IT', { weekday:'short', day:'2-digit', month:'short' }), formatTime = (timestamp) => new Date(timestamp).toLocaleTimeString('it-IT', { hour:'2-digit', minute:'2-digit' }), toggleRoom = (room) => { const next={...roomsDone}; if(next[room]) delete next[room]; else next[room]={by:user.name,at:Date.now()}; onUpdate({roomsDone:next},false) }
  const markToFinish = () => onUpdate({ status:'da_finire', toFinishBy:user.name, toFinishAt:Date.now() }, false)
  return <div className="urgent-transform-backdrop" onClick={onClose}><section className="planned-detail" onClick={(event) => event.stopPropagation()}><header><button className="back-link" onClick={onClose}>‹ Chiudi</button><div>{canCreatePlanned(user) && <button className="planned-edit" onClick={onEdit}>Modifica</button>}{canCreatePlanned(user) && <button className="delete-issue-compact" onClick={onDelete}>Elimina</button>}</div></header><h2>{item.locationMode === 'camera' ? `Camera ${item.location}` : item.location} · Intervento</h2><article><small>DETTAGLI INTERVENTO</small><span className="planned-category">{item.category}</span><p>{item.notes}</p>{item.status === 'da_finire' && <div className="status-note to-finish">Segnato da finire da <strong>{item.toFinishBy}</strong> · {new Date(item.toFinishAt).toLocaleString('it-IT')}</div>}{item.rooms?.length > 0 && <div className="room-checklist"><strong>{Object.keys(roomsDone).length} di {item.rooms.length} camere</strong><div>{item.rooms.map((room) => <button key={room} className={roomsDone[room] ? 'done' : ''} onClick={() => toggleRoom(room)}>{room}</button>)}</div><small>Tocca di nuovo una camera per togliere la spunta.</small></div>}<em>Creato da {item.createdBy} · {new Date(item.createdAt).toLocaleString('it-IT')}</em></article><div className="planned-meta-grid"><article className="planned-date"><small>PERIODO PREVISTO</small><div className="planned-date-range"><span><i>DA</i><strong>{formatDay(item.scheduledAt)}</strong><b>{formatTime(item.scheduledAt)}</b></span><span><i>A</i><strong>{formatDay(item.scheduledUntil || item.scheduledAt)}</strong><b>{formatTime(item.scheduledUntil || item.scheduledAt)}</b></span></div></article><article className="planned-assignment"><small>ASSEGNATO A</small><div className="planned-assignees">{item.assignees.map((person) => <span key={person.id}>👤 {person.name}</span>)}</div></article></div><label className={`planned-photo ${photo ? 'has-photo' : ''}`}><input type="file" accept="image/*" capture="environment" onChange={async (event) => setPhoto(await readPhotoAsDataUrl(event.target.files?.[0]))} /><span className="planned-photo-icon"><Icon name="camera" /></span><span><strong>{photo ? 'Cambia foto finale' : 'Aggiungi foto finale'}</strong><small>Opzionale · scatta o scegli una foto</small></span>{photo && <img src={photo} alt="Anteprima foto finale" />}</label>{canComplete && <div className="planned-actions"><button className="secondary to-finish-action" onClick={markToFinish}>◐ Segna da finire</button><button className="planned-complete" onClick={() => onCompleteToIssues(photo)}>✓ Intervento completato</button></div>}</section></div>
}

function InterventionsSection({ items, user, onOpen }) { const [search, setSearch] = useState(''), [view, setView] = useState('pending'), pending = items.filter((item) => item.status !== 'done'), done = items.filter((item) => item.status === 'done'), list = view === 'done' ? done : pending, filtered = list.filter((item) => !search || `${item.location} ${item.notes} ${item.assignees?.map((person) => person.name).join(' ')}`.toLowerCase().includes(search.toLowerCase())); return <section className="interventions-section">{canCreatePlanned(user) && (pending.length > 0 || done.length > 0) && <div className="planned-stats"><article className={view === 'pending' ? 'active' : ''} onClick={() => setView('pending')} role="button" tabIndex={0}><strong>{pending.length}</strong><span>Da fare</span></article><button onClick={() => setView(view === 'done' ? 'pending' : 'done')}><strong>{done.length}</strong><span>{view === 'done' ? '← Da fare' : 'Completati →'}</span></button></div>}<label className="search planned-search"><span className="sr-only">Cerca interventi</span><Icon name="search"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cerca camera, nome, assegnatario..." /></label>{filtered.length > 0 && <h2 className="planned-list-title">{view === 'done' ? 'Completati' : 'Da completare'} · {filtered.length}</h2>}<div className="planned-list">{filtered.map((item) => <PlannedCard key={item.id} item={item} user={user} onOpen={() => onOpen(item.id)} />)}{!filtered.length && <div className="planned-empty"><Icon name="calendar"/><strong>{view === 'done' ? 'Nessun intervento completato' : 'Nessun intervento da completare'}</strong>{view === 'pending' && canCreatePlanned(user) && <small>Usa il pulsante + per crearne uno</small>}</div>}</div></section> }

function AppNav({ tab, onSelect, onAltro, isAltroActive, showPlanning, showInterventi, interventiBadge, urgentBadge, primaryAction }) {
  const items = [
    { key: 'Home', label: 'Home', icon: 'hotel' },
    { key: 'Segnalazioni', label: 'Segnalazioni', icon: 'clipboard' },
    ...(showInterventi ? [{ key: 'Interventi', label: 'Interventi', icon: 'tool', badge: interventiBadge }] : []),
    ...(showPlanning ? [{ key: 'Planning', label: 'Planning', icon: 'calendar', match: ['Planning', 'Planning Lavori', 'Planning Sale'] }] : []),
  ]
  const splitAt = Math.min(2, items.length)
  const renderItem = (item) => <button type="button" key={item.key} className={(item.match || [item.key]).includes(tab) ? 'active' : ''} aria-current={(item.match || [item.key]).includes(tab) ? 'page' : undefined} onClick={() => onSelect(item.key)}>
    <Icon name={item.icon} /><span>{item.label}</span>{item.badge > 0 && <b className="tab-badge app-nav-badge">{item.badge}</b>}
  </button>
  return <nav className="app-nav" aria-label="Navigazione principale">
    {items.slice(0, splitAt).map(renderItem)}
    {primaryAction && <button type="button" className="app-nav-fab" aria-label={primaryAction.label} onClick={primaryAction.onClick}><span className="app-nav-fab-plus">+</span></button>}
    {items.slice(splitAt).map(renderItem)}
    <button type="button" className={isAltroActive ? 'active' : ''} aria-haspopup="true" onClick={onAltro}>
      <Icon name="menu" /><span>Altro</span>
      {urgentBadge > 0 && <b className="tab-badge app-nav-badge">{urgentBadge}</b>}
    </button>
  </nav>
}

function FeedbackAdminSection({ hotel }) {
  const [items, setItems] = useState([])
  const refresh = async () => { const { items: rows } = await fetchFeedback(hotel.id); setItems(rows) }
  useEffect(() => { refresh(); const unsub = subscribeFeedback(hotel.id, refresh); return unsub }, [hotel.id])
  return <section className="feedback-admin">{items.length ? <div className="feedback-admin-list">{items.map((item) => <article key={item.id}><strong>{item.userName}</strong><span>{item.text}</span><small>{new Date(item.createdAt).toLocaleString('it-IT')}</small></article>)}</div> : <div className="empty"><strong>Nessun feedback</strong><span>I suggerimenti inviati dallo staff compariranno qui.</span></div>}</section>
}

function PlanningChoice({ hotel, onGoWork, onGoSale }) {
  return <section className="dash-home"><div className="dash-greeting"><h1>Planning</h1><p>Cosa vuoi consultare?</p></div><div className="dash-cards"><button type="button" className="dash-card" onClick={onGoWork}><span className="dash-card-icon"><Icon name="tool" /></span><span className="dash-card-body"><strong>Planning lavori</strong><span>Interventi programmati e assegnazioni</span></span><Icon name="arrow" /></button>{hotel.id === 'hotelgio' && <button type="button" className="dash-card" onClick={onGoSale}><span className="dash-card-icon"><Icon name="calendar" /></span><span className="dash-card-body"><strong>Planning Sale</strong><span>Prenotazioni sale e turni</span></span><Icon name="arrow" /></button>}</div></section>
}

function HomeDashboard({ userName, hotel, statusCounts, showUrgent, urgentCount, showInterventi, todayPlannedCount, showPendingUrgent, pendingUrgentCount, showPlanning, canCreateIssue, recentIssues, onGoSegnalazioni, onGoUrgenti, onGoInterventi, onGoPlanning, onNewIssue, onOpenRecent }) {
  const openIssues = (statusCounts.todo || 0) + (statusCounts.tecnico || 0) + (statusCounts.waiting || 0)
  const firstName = (userName || '').split(' ')[0]
  return <section className="dash-home">
    <div className="dash-greeting"><h1>Ciao{firstName ? `, ${firstName}` : ''}</h1><p>{hotel.name} · ecco la situazione di oggi</p></div>
    <div className="dash-cards">
      <button type="button" className="dash-card" onClick={onGoSegnalazioni}><span className="dash-card-icon"><Icon name="clipboard" /></span><span className="dash-card-body"><strong>Segnalazioni aperte</strong><span>Da fare, in attesa o dal tecnico</span></span><span className="dash-card-count">{openIssues}</span></button>
      {showUrgent && <button type="button" className={`dash-card ${urgentCount > 0 ? 'urgent' : ''}`} onClick={onGoUrgenti}><span className="dash-card-icon"><Icon name="alert" /></span><span className="dash-card-body"><strong>Urgenti</strong><span>{urgentCount > 0 ? 'Richiedono attenzione ora' : 'Nessun avviso attivo'}</span></span><span className="dash-card-count">{urgentCount}</span></button>}
      {showInterventi && <button type="button" className="dash-card" onClick={onGoInterventi}><span className="dash-card-icon"><Icon name="tool" /></span><span className="dash-card-body"><strong>Interventi di oggi</strong><span>Pianificati per oggi</span></span><span className="dash-card-count">{todayPlannedCount}</span></button>}
      {showPendingUrgent && <button type="button" className={`dash-card ${pendingUrgentCount > 0 ? 'urgent' : ''}`} onClick={onGoUrgenti}><span className="dash-card-icon"><Icon name="alert" /></span><span className="dash-card-body"><strong>Da prendere in carico</strong><span>Avvisi non ancora presi in carico</span></span><span className="dash-card-count">{pendingUrgentCount}</span></button>}
      {showPlanning && <button type="button" className="dash-card dash-card-desktop-only" onClick={onGoPlanning}><span className="dash-card-icon"><Icon name="calendar" /></span><span className="dash-card-body"><strong>Planning lavori</strong><span>Calendario interventi</span></span></button>}
    </div>
    {canCreateIssue && <div className="dash-quick"><button type="button" onClick={onNewIssue}>＋ Nuova segnalazione</button></div>}
    <div className="dash-recent"><h2>Attività recenti</h2>{recentIssues && recentIssues.length ? <div className="dash-recent-list">{recentIssues.slice(0, 3).map((issue) => <button type="button" className="dash-recent-item" key={issue.id} onClick={() => onOpenRecent(issue.id)}><span><strong>{issue.room}</strong><span>{issue.title}</span></span><Icon name="arrow" /></button>)}</div> : <div className="dash-recent-empty"><strong>Nessuna attività recente</strong><span>Le ultime attività appariranno qui</span></div>}</div>
  </section>
}

function Operations({ hotel, user, users, onLogout, onChangeHotel, onSavePin, onSaveProfile, onTogglePresence, uiSize, onUiSizeChange }) {
  useUnlockUrgentAudio(user)
  const [tab, setTab] = useState('Home'), [status, setStatus] = useState('todo'), [query, setQuery] = useState(''), [sort, setSort] = useState('urgenza'), [advanced, setAdvanced] = useState(false), [department, setDepartment] = useState(''), [category, setCategory] = useState(''), [creatingIssue, setCreatingIssue] = useState(false), [openIssueId, setOpenIssueId] = useState(null), [menuOpen, setMenuOpen] = useState(false), [allIssues, setAllIssues] = useState([]), [urgentItems, setUrgentItems] = useState([]), [urgentComposeRequest, setUrgentComposeRequest] = useState(0), [urgentTransformTarget, setUrgentTransformTarget] = useState(null), [plannedItems, setPlannedItems] = useState([]), [plannedFormOpen, setPlannedFormOpen] = useState(false), [openPlannedId, setOpenPlannedId] = useState(null), [editingPlannedId, setEditingPlannedId] = useState(null), [saleComposeRequest, setSaleComposeRequest] = useState(0), [technicianDirectoryOpen, setTechnicianDirectoryOpen] = useState(false)
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine)
  useEffect(() => {
    const goOnline = () => setOnline(true), goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline); window.addEventListener('offline', goOffline)
    return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline) }
  }, [])
  // Presenza: solo per manutentori, salvata su Supabase (utenti.in_struttura),
  // si spegne da sola dopo 7h20m (PRESENCE_MAX_MS) — il valore da user.in_struttura
  // arriva già corretto dal server (pin-auth calcola la scadenza a ogni caricamento).
  const presence = user.role === 'manutentore' && Boolean(user.in_struttura) && !isPresenceExpired(user.in_struttura_dal ? new Date(user.in_struttura_dal).getTime() : null)
  useEffect(() => {
    if (user.role !== 'manutentore' || !presence || !user.in_struttura_dal) return
    const since = new Date(user.in_struttura_dal).getTime(), remaining = PRESENCE_MAX_MS - (Date.now() - since)
    if (remaining <= 0) { onTogglePresence(false); return }
    const timer = setTimeout(() => onTogglePresence(false), remaining)
    return () => clearTimeout(timer)
  }, [user.role, presence, user.in_struttura_dal, onTogglePresence])
  const reloadIssues = useCallback(async () => { const { issues } = await fetchIssues(hotel.id); setAllIssues(issues) }, [hotel.id]); useEffect(() => { reloadIssues(); const unsub = subscribeIssues(hotel.id, (payload) => { if (payload?.eventType === 'INSERT') playNotifSound(); reloadIssues() }); return unsub }, [hotel.id, reloadIssues])
  const reloadUrgents = useCallback(async () => { const { items } = await fetchUrgents(hotel.id); setUrgentItems(items) }, [hotel.id]); useEffect(() => { reloadUrgents(); const unsub = subscribeUrgents(hotel.id, (payload) => { if (payload?.eventType === 'INSERT') playNotifSound(); reloadUrgents() }); return unsub }, [hotel.id, reloadUrgents])
  const reloadPlanned = useCallback(async () => { const { items } = await fetchPlanned(hotel.id); setPlannedItems(items) }, [hotel.id]); useEffect(() => { reloadPlanned(); const unsub = subscribePlanned(hotel.id, reloadPlanned); return unsub }, [hotel.id, reloadPlanned])
  const saveIssue = useCallback(async (issue) => { const created = await insertIssue({ ...issue, hotelId: hotel.id }); if (created) setAllIssues((list) => [created, ...list.filter((i) => i.id !== created.id)]); else setAllIssues((list) => [issue, ...list]); setStatus('todo'); setTab('Segnalazioni'); setCreatingIssue(false) }, [hotel.id])
  const closeIssueForm = useCallback(() => setCreatingIssue(false), [])
  const updateIssue = async (id, changes) => { setAllIssues((list) => list.map((item) => item.id === id ? { ...item, ...changes } : item)); await updateIssueRow(id, changes) }, deleteIssue = async (id) => { setAllIssues((list) => list.filter((item) => item.id !== id)); await deleteIssueRow(id) }, openIssue = allIssues.find((item) => item.id === openIssueId) || null
  const permissions = ROLE_PERMISSIONS[user.role] || [], tabs = ['Segnalazioni', ...(canViewUrgent(user) ? ['Avvisi Urgenti'] : []), ...(canViewPlanned(user) ? ['Interventi'] : []), ...(canViewHousekeeping(user) ? ['Housekeeping'] : [])], tabIcons = { Segnalazioni: 'clipboard', 'Avvisi Urgenti': 'alert', Interventi: 'tool', Housekeeping: 'housekeeping', 'Planning Lavori': 'calendar', 'Planning Sale': 'calendar' }
  // Chi può solo creare segnalazioni (segnalatore, Portiere Notturno: create+read_own_hotel,
  // nessun altro permesso) vede solo le proprie, non quelle dell'intera struttura.
  const ownIssuesOnly = !permissions.includes('assign') && !permissions.includes('complete') && !permissions.includes('take_charge') && !permissions.includes('read_all_departments')
  const hotelIssues = useMemo(() => allIssues.filter((issue) => issue.hotelId === hotel.id && (!ownIssuesOnly || issue.createdByName === user.name)), [allIssues, hotel.id, ownIssuesOnly, user.name]), hotelPlanned = useMemo(() => plannedItems.filter((item) => item.hotelId === hotel.id), [plannedItems, hotel.id]), openPlanned = hotelPlanned.find((item) => item.id === openPlannedId) || null, editingPlanned = hotelPlanned.find((item) => item.id === editingPlannedId) || null, pendingPlannedCount = hotelPlanned.filter((item) => item.status !== 'done').length, statusCounts = useMemo(() => hotelIssues.reduce((acc, issue) => ({ ...acc, [issue.status]: (acc[issue.status] || 0) + 1 }), {}), [hotelIssues]), issues = useMemo(() => hotelIssues.filter((issue) => issue.status === status).filter((issue) => !query || `${issue.room} ${issue.title}`.toLowerCase().includes(query.toLowerCase())).filter((issue) => !department || issue.department === department).filter((issue) => !category || issue.category === category).sort((a, b) => { if (sort === 'camera') return a.room.localeCompare(b.room, 'it', { numeric: true }); if (sort === 'data') return b.id - a.id; const weight = { alta: 3, media: 2, bassa: 1 }; return weight[b.urgency] - weight[a.urgency] || a.id - b.id }), [hotelIssues, status, query, sort, department, category])
  const todayStart = new Date(); todayStart.setHours(0,0,0,0); const todayEnd = new Date(); todayEnd.setHours(23,59,59,999)
  const todayPlannedCount = hotelPlanned.filter((item) => item.status !== 'done' && item.scheduledAt <= todayEnd.getTime() && (item.scheduledUntil || item.scheduledAt) >= todayStart.getTime()).length
  const recentIssues = useMemo(() => [...hotelIssues].sort((a, b) => b.id - a.id).slice(0, 3), [hotelIssues])
  const goToWorkPlanning = () => { setTab('Planning Lavori'); setMenuOpen(false) }, goToPlanning = () => { setTab('Planning Sale'); setMenuOpen(false) }, goToTemperature = () => { setTab('Temperature'); setMenuOpen(false) }, isDedicatedPage = tab === 'Planning Lavori' || tab === 'Planning Sale' || tab === 'Temperature', planningBackTarget = hotel.id === 'hotelgio' ? 'Planning' : 'Segnalazioni'
  const clearCache = async () => { if ('caches' in window) { const keys = await caches.keys(); await Promise.all(keys.map((key) => caches.delete(key))) } window.location.reload() }
  const primaryAction = tab === 'Planning Lavori' && canViewPlanningMenu(user) ? { label: 'Nuovo lavoro', onClick: () => setPlannedFormOpen(true) } : tab === 'Planning Sale' && hotel.id === 'hotelgio' && ['admin', 'Responsabile', 'Direttore Centro Congressi'].includes(user.role) ? { label: 'Nuova prenotazione', onClick: () => setSaleComposeRequest((value) => value + 1) } : !['Interventi', 'Avvisi Urgenti', 'Planning Lavori', 'Planning Sale'].includes(tab) && permissions.includes('create') && !creatingIssue && !openIssue ? { label: 'Nuova segnalazione', onClick: () => { setTab('Segnalazioni'); setCreatingIssue(true) } } : null
  const createUrgent = async (text) => { const created = await insertUrgent({ hotelId: hotel.id, note: text, status: 'aperta', createdBy: user.name }); setUrgentItems((list) => [created, ...list.filter((i) => i.id !== created.id)]); notifyUrgent(hotel.id, text) }, updateUrgent = async (id, changes) => { setUrgentItems((list) => list.map((item) => item.id === id ? { ...item, ...changes } : item)); try { await updateUrgentRow(id, changes) } catch (error) { console.error('updateUrgent', error) } }, takeUrgent = (id) => updateUrgent(id, { status: 'presa_in_carico', takenBy: user.name }), completeUrgent = (id) => updateUrgent(id, { status: 'completata', completedBy: user.name }), transformUrgent = (urgent, data) => { saveIssue({ hotelId: hotel.id, urgency: data.urgency, room: `${data.mode === 'camera' ? 'Camera' : 'Zona'} · ${data.location.trim()}`, title: data.note.trim(), status: 'todo', department: user.department || user.role, category: data.category, origin: 'Avviso urgente', createdByName: user.name }); updateUrgent(urgent.id, { status: 'completata', completedBy: user.name, completedAt: Date.now(), transformed: true }); setUrgentTransformTarget(null) }, openUrgentCount = urgentItems.filter((item) => item.hotelId === hotel.id && item.status !== 'completata').length, activeUrgents = urgentItems.filter((item) => item.hotelId === hotel.id && item.status !== 'completata'), pendingUrgentCount = urgentItems.filter((item) => item.hotelId === hotel.id && item.status === 'aperta').length
  useEffect(() => { if (canManageUrgent(user) && openUrgentCount) triggerUrgentSiren() }, [openUrgentCount, user])
  // Ad app in background (tab non a fuoco, o schermo appena riacceso) il push
  // arriva comunque al service worker anche se la sottoscrizione realtime e'
  // in ritardo per il throttling del browser: il service worker avvisa la
  // pagina con un postMessage, cosi' la sirena vera parte comunque appena
  // l'app torna visibile.
  useEffect(() => {
    if (!canManageUrgent(user) || !('serviceWorker' in navigator)) return
    const onMessage = (event) => { if (event.data?.type === 'urgenza-push') triggerUrgentSiren() }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [user])
  const savePlanned = async (draft) => { const dates = { scheduledAt:new Date(draft.scheduledAt).getTime(), scheduledUntil:new Date(draft.scheduledUntil).getTime() }; if (editingPlanned) { const item = { ...editingPlanned, ...draft, ...dates }; setPlannedItems((list) => list.map((current) => current.id === item.id ? item : current)); await updatePlannedRow(item.id, item) } else { const item = { ...draft, ...dates, hotelId:hotel.id, status:'pending', createdBy:user.name }; const created = await insertPlanned(item); if (created) setPlannedItems((list) => [created, ...list]) } setPlannedFormOpen(false); setEditingPlannedId(null) }, updatePlanned = async (id, changes, close = true) => { setPlannedItems((list) => list.map((item) => item.id === id ? { ...item, ...changes } : item)); await updatePlannedRow(id, changes); if (close) setOpenPlannedId(null) }, deletePlanned = async (id) => { if (!window.confirm('Eliminare questo intervento?')) return; setPlannedItems((list) => list.filter((item) => item.id !== id)); await deletePlannedRow(id); setOpenPlannedId(null) }, completePlanned = async (item, completionPhotoData = null) => { const completedAt = Date.now(); setPlannedItems((list) => list.map((current) => current.id === item.id ? { ...current, status:'done', completedBy:user.name, completedAt, photoAfter:completionPhotoData } : current)); await updatePlannedRow(item.id, { status:'done', completedBy:user.name, completedAt, photoAfter:completionPhotoData }); saveIssue({ hotelId:hotel.id, urgency:'media', room:`${item.locationMode === 'camera' ? 'Camera' : 'Zona'} · ${item.location}`, title:item.notes, status:'done', department:user.role, category:item.category, origin:'Intervento pianificato', completedAt, completedBy:user.name, pieceReplaced:item.pieceReplaced, completionPhotoData }); setOpenPlannedId(null) }
  return <div className={`operations theme-${hotel.tone}`}><header className="ops-header"><div className="hotel-identity"><HotelMark hotel={hotel} /><span><strong>{hotel.name}</strong><small>{user.name} · {user.role}</small></span></div>{user.role === 'manutentore' && <button className={`presence ${presence ? 'on' : ''}`} onClick={() => onTogglePresence(!presence)}><span /> Sono in struttura</button>}</header><AppNav tab={tab} onSelect={setTab} onAltro={() => setMenuOpen(true)} isAltroActive={['Housekeeping','Avvisi Urgenti','Feedback ricevuti','Il mio profilo','Cambia PIN','Manuale','Feedback'].includes(tab)} showPlanning={canViewPlanningMenu(user)} showInterventi={canViewPlanned(user)} interventiBadge={pendingPlannedCount} urgentBadge={canManageUrgent(user) ? openUrgentCount : 0} primaryAction={primaryAction} />{menuOpen && <div className="drawer-backdrop" onClick={() => setMenuOpen(false)}><aside className="app-drawer" aria-label="Menu principale" onClick={(event) => event.stopPropagation()}><header><div><strong>{hotel.name}</strong><span>{user.name} · {user.role}</span></div><button className="panel-close" onClick={() => setMenuOpen(false)} aria-label="Chiudi menu"><Icon name="close" /></button></header><nav>{user.role === 'admin' && <button onClick={() => { setTab('Feedback ricevuti'); setMenuOpen(false) }}><Icon name="message" /><span>Feedback ricevuti</span></button>}{canViewHousekeeping(user) && <button onClick={() => { setTab('Housekeeping'); setMenuOpen(false) }}><Icon name="housekeeping" /><span>{'Housekeeping'}</span></button>}{canViewUrgent(user) && <button onClick={() => { setTab('Avvisi Urgenti'); setMenuOpen(false) }}><Icon name="alert" /><span>Avvisi urgenti</span>{openUrgentCount > 0 && <b className="tab-badge">{openUrgentCount}</b>}</button>}<button onClick={clearCache}><Icon name="refresh" /><span>Pulisci cache</span></button><button onClick={onChangeHotel}><Icon name="hotel" /><span>Cambia struttura</span></button><button onClick={() => { setTab('Il mio profilo'); setMenuOpen(false) }}><Icon name="user" /><span>Il mio profilo</span></button><button onClick={() => { setTab('Cambia PIN'); setMenuOpen(false) }}><Icon name="lock" /><span>Cambia PIN</span></button><button onClick={() => { setTab('Manuale'); setMenuOpen(false) }}><Icon name="book" /><span>Manuale</span></button><button onClick={() => { setTab('Feedback'); setMenuOpen(false) }}><Icon name="message" /><span>Feedback</span></button><button onClick={() => { exportIssuesCsv(hotelIssues, hotel); setMenuOpen(false) }} disabled={!hotelIssues.length}><Icon name="download" /><span>Esporta CSV</span></button>{canViewTechnicianDirectory(user) && <button onClick={() => { setTechnicianDirectoryOpen(true); setMenuOpen(false) }}><Icon name="phone" /><span>Rubrica tecnici</span></button>}{canViewPlanningMenu(user) && <button onClick={goToWorkPlanning}><Icon name="calendar" /><span>Planning lavori</span></button>}{hotel.id === 'hotelgio' && canViewPlanningMenu(user) && <button onClick={goToPlanning}><Icon name="calendar" /><span>Planning Sale</span></button>}{canViewTemperature(user) && <button onClick={goToTemperature}><Icon name="temperature" /><span>Temperature</span></button>}</nav><button className="drawer-logout" onClick={onLogout}><Icon name="logout" /><span>Logout</span></button></aside></div>}{urgentTransformTarget && <UrgentTransformModal urgent={urgentTransformTarget} hotel={hotel} onClose={() => setUrgentTransformTarget(null)} onSave={(data) => transformUrgent(urgentTransformTarget, data)} />}{technicianDirectoryOpen && <TechnicianDirectory users={users} onClose={() => setTechnicianDirectoryOpen(false)} />}{(plannedFormOpen || editingPlanned) && <PlannedForm hotel={hotel} users={users} initial={editingPlanned ? { ...editingPlanned, scheduledAt:toLocalDateTimeInput(editingPlanned.scheduledAt), scheduledUntil:toLocalDateTimeInput(editingPlanned.scheduledUntil || editingPlanned.scheduledAt) } : null} onClose={() => { setPlannedFormOpen(false); setEditingPlannedId(null) }} onSave={savePlanned} />}{openPlanned && <PlannedDetail item={openPlanned} user={user} onClose={() => setOpenPlannedId(null)} onUpdate={(changes,close) => updatePlanned(openPlanned.id,changes,close)} onDelete={() => deletePlanned(openPlanned.id)} onEdit={() => { setEditingPlannedId(openPlanned.id); setOpenPlannedId(null) }} onCompleteToIssues={(photo) => completePlanned(openPlanned,photo)} />}<main className={`ops-main ${isDedicatedPage ? 'planning-page-main' : ''}`}>{isDedicatedPage ? <button className="planning-back" onClick={() => setTab(tab === 'Temperature' ? 'Segnalazioni' : planningBackTarget)}>‹ Area operativa</button> : tab !== 'Housekeeping' && tab !== 'Home' && tab !== 'Planning' && <div className="title-row ops-title"><h1>{tab}</h1></div>}{tab !== 'Avvisi Urgenti' && canManageUrgent(user) && <UrgentBanner items={activeUrgents} onOpen={() => setTab('Avvisi Urgenti')} onTake={takeUrgent} onComplete={completeUrgent} onTransform={setUrgentTransformTarget} />}{openIssue && <IssueDetail issue={openIssue} permissions={permissions} currentUser={user} users={users} onClose={() => setOpenIssueId(null)} onUpdate={updateIssue} onDelete={deleteIssue} />}{tab === 'Home' ? <HomeDashboard userName={user.name} hotel={hotel} statusCounts={statusCounts} showUrgent={canViewUrgent(user)} urgentCount={openUrgentCount} showInterventi={canViewPlanned(user)} todayPlannedCount={todayPlannedCount} showPendingUrgent={canManageUrgent(user)} pendingUrgentCount={pendingUrgentCount} showPlanning={canViewPlanningMenu(user)} canCreateIssue={permissions.includes('create')} recentIssues={recentIssues} onGoSegnalazioni={() => setTab('Segnalazioni')} onGoUrgenti={() => setTab('Avvisi Urgenti')} onGoInterventi={() => setTab('Interventi')} onGoPlanning={() => setTab('Planning Lavori')} onNewIssue={() => { setTab('Segnalazioni'); setCreatingIssue(true) }} onOpenRecent={(id) => { setTab('Segnalazioni'); setOpenIssueId(id) }} /> : tab === 'Segnalazioni' ? <>{creatingIssue && <NewIssueForm hotel={hotel} user={user} onCancel={closeIssueForm} onSave={saveIssue} />}<div className="status-tabs">{[['todo','Da fare'],['tecnico','Tecnico'],['waiting','Attesa pezzo'],['done','Completate']].map(([key,label]) => <button className={status === key ? 'active' : ''} key={key} onClick={() => setStatus(key)}>{label} <span className="status-count">{statusCounts[key] || 0}</span></button>)}</div><div className="toolbar"><label className="search"><span className="sr-only">Cerca segnalazioni</span><Icon name="search"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Camera, zona o problema" /></label><div className="toolbar-actions"><select aria-label="Ordinamento" value={sort} onChange={(event) => setSort(event.target.value)}><option value="urgenza">Ordina: urgenza</option><option value="camera">Ordina: camera/zona</option><option value="data">Ordina: data</option></select><button className={`secondary filter-toggle ${advanced ? 'active' : ''}`} onClick={() => setAdvanced(!advanced)} aria-expanded={advanced}><Icon name="filter" /><span>Filtri</span><Icon name="chevron" /></button></div></div>{advanced && <div className="advanced-filters"><select value={department} onChange={(event) => setDepartment(event.target.value)}><option value="">Tutti i reparti</option><option>Governante</option><option>Reception</option><option>Isola dei Golosi</option></select><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">Tutte le categorie</option><option>Idraulica</option><option>Elettrica</option><option>Climatizzazione</option></select><select disabled><option>Origine: tutte</option></select><input type="date" aria-label="Data" /></div>}<section className="issue-list" aria-live="polite">{issues.length ? issues.map((issue) => <article className={`issue ${issue.urgency}`} key={issue.id} onClick={() => setOpenIssueId(issue.id)} role="button" tabIndex={0} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setOpenIssueId(issue.id)}><span className="urgency">{issue.urgency}</span><div><h3>{issue.room}</h3><p>{issue.title}</p><small>{issue.department} · {issue.category} · {issue.date}{issue.photoData ? ' · Foto' : ''}{issue.status === 'waiting' ? ` · In attesa: ${issue.pieceName}` : ''}{issue.status === 'tecnico' ? ' · Tecnico richiesto' : ''}</small></div><Icon name="arrow" /></article>) : <div className="empty"><strong>Nessuna segnalazione</strong><span>Non ci sono elementi con questi filtri.</span></div>}</section></> : tab === 'Avvisi Urgenti' ? <UrgentSection hotel={hotel} user={user} users={users} items={urgentItems} openRequest={urgentComposeRequest} onCreate={createUrgent} onTake={takeUrgent} onComplete={completeUrgent} onTransform={setUrgentTransformTarget} /> : tab === 'Interventi' ? <InterventionsSection items={hotelPlanned} user={user} onOpen={setOpenPlannedId} /> : tab === 'Planning' ? <PlanningChoice hotel={hotel} onGoWork={goToWorkPlanning} onGoSale={goToPlanning} /> : tab === 'Planning Lavori' ? <PlanningWork items={hotelPlanned} onOpen={setOpenPlannedId} /> : tab === 'Planning Sale' ? <PlanningSale hotel={hotel} user={user} openRequest={saleComposeRequest} /> : tab === 'Feedback ricevuti' ? <FeedbackAdminSection hotel={hotel} /> : tab === 'Temperature' ? <TemperatureSensors hotel={hotel} /> : tab === 'Housekeeping' ? <Housekeeping user={user} hotel={hotel} /> : ['Il mio profilo','Cambia PIN','Manuale','Feedback'].includes(tab) ? <MenuPanel type={tab} user={user} hotel={hotel} onSavePin={onSavePin} onSaveProfile={onSaveProfile} uiSize={uiSize} onUiSizeChange={onUiSizeChange} /> : <div className="placeholder"><h2>{tab}</h2><p>Sezione predisposta per la prossima fase.</p></div>}</main>{!['Temperature','Housekeeping'].includes(tab) && (!online || !isSupabaseConfigured) && <p className={`local-data-note ${!online ? 'offline' : ''}`}>{!online ? 'Offline · puoi continuare a lavorare' : 'Dati salvati solo localmente su questo dispositivo'}</p>}{tab === 'Avvisi Urgenti' && canSendUrgent(user) && <button className="fab-new-issue planned-fab urgent-fab-scoped" onClick={() => setUrgentComposeRequest((value) => value + 1)}>🚨 Nuovo avviso urgente</button>}{tab === 'Interventi' && canCreatePlanned(user) && <button className="fab-new-issue planned-fab" onClick={() => setPlannedFormOpen(true)}>＋ Nuovo intervento</button>}</div>
}

export default function App() {
  const [uiSize, setUiSize] = useState(loadUiSize)
  const [users, setUsers] = useState([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [adminUsers, setAdminUsers] = useState([])
  const [adminStage, setAdminStage] = useState(null)
  const [session, setSession] = useState(loadSession)
  const [sessionChecked, setSessionChecked] = useState(false)
  const [selectedHotel, setSelectedHotel] = useState(() => HOTELS.find((hotel) => hotel.id === loadSession()?.hotelId) || null)
  const hotel = HOTELS.find((item) => item.id === session?.hotelId)
  const user = users.find((item) => item.id === session?.userId || item.auth_user_id === session?.userId)

  const loadDirectory = useCallback(async (hotelId) => {
    if (!hotelId) { setUsers([]); return }
    setUsersLoading(true)
    try { const { users: rows } = await fetchDirectory(hotelId); setUsers(rows) } catch { setUsers([]) } finally { setUsersLoading(false) }
  }, [])

  useEffect(() => { if (selectedHotel?.id) loadDirectory(selectedHotel.id) }, [selectedHotel?.id, loadDirectory])

  useEffect(() => {
    let active = true
    ;(async () => {
      const local = loadSession()
      const result = await validateSupabaseSession()
      if (!active) return
      if (local && !result.valid) {
        clearSession(); setSession(null); setSelectedHotel(null)
      } else if (local && result.valid) {
        const next = { ...local, userId: result.user.id }
        if (local.userId !== result.user.id) saveSession(next)
        setSession(next)
        const restoredHotel = HOTELS.find((item) => item.id === next.hotelId) || null
        setSelectedHotel(restoredHotel)
        if (restoredHotel) await loadDirectory(restoredHotel.id)
      }
      if (active) setSessionChecked(true)
    })()
    return () => { active = false }
  }, [loadDirectory])

  const reloadAdminUsers = async () => { const { users: rows } = await fetchUsers(); setAdminUsers(rows); return rows }
  const openAdmin = async () => { await reloadAdminUsers(); setAdminStage('panel') }
  const closeAdmin = async () => { await signOutSupabase(); setAdminStage(null); setAdminUsers([]) }

  const login = async (directoryUser, authSession) => {
    const authUserId = authSession?.user?.id || directoryUser.id
    const authenticatedUser = { ...directoryUser, id: authUserId, auth_user_id: authUserId, directory_user_id: directoryUser.id, hotels: Array.isArray(directoryUser.hotels) && directoryUser.hotels.length ? directoryUser.hotels : [selectedHotel.id] }
    setUsers((rows) => [authenticatedUser, ...rows.filter((item) => item.id !== directoryUser.id && item.id !== authUserId)])
    const next = { hotelId: selectedHotel.id, userId: authUserId, createdAt: Date.now() }
    saveSession(next); setSession(next)
  }
  const updateCurrentUserPin = async (currentPin, newPin) => { await changeOwnPin({ currentPin, newPin }) }
  const updateCurrentUserProfile = async (changes) => { await updateOwnProfile({ email: changes.email, phone: changes.phone, phoneCountryCode: changes.phone_country_code }); await loadDirectory(selectedHotel.id) }
  const updateCurrentUserPresence = useCallback(async (present) => { try { await setOwnPresence(present) } catch { /* riprovato al prossimo tentativo, lo stato locale non cambia se la scrittura fallisce */ return } await loadDirectory(selectedHotel.id) }, [selectedHotel, loadDirectory])
  const logout = async () => { await signOutSupabase(); clearSession(); setSession(null); setSelectedHotel(null); setUsers([]) }
  const changeHotel = async () => { await signOutSupabase(); clearSession(); setSession(null); setSelectedHotel(null); setUsers([]) }
  const backFromLogin = async () => { await signOutSupabase(); clearSession(); setSession(null); setSelectedHotel(null); setUsers([]) }

  useEffect(() => { document.documentElement.dataset.uiSize = uiSize; saveUiSize(uiSize) }, [uiSize])
  if (!sessionChecked) return <div className="page login-page"><main className="login-panel"><p>Verifica sessione…</p></main></div>
  if (session && hotel && user && (!Array.isArray(user.hotels) || user.hotels.includes(hotel.id))) return <Operations hotel={hotel} user={user} users={users} onLogout={logout} onChangeHotel={changeHotel} onSavePin={updateCurrentUserPin} onSaveProfile={updateCurrentUserProfile} onTogglePresence={updateCurrentUserPresence} uiSize={uiSize} onUiSizeChange={setUiSize} />
  if (adminStage === 'panel') return <div className="operations"><main className="ops-main global-admin"><AdminPanel users={adminUsers} onReload={reloadAdminUsers} onClose={closeAdmin} /></main></div>
  if (adminStage === 'pin') return <AdminGate onBack={closeAdmin} onSuccess={openAdmin} />
  if (selectedHotel) return <Login hotel={selectedHotel} users={users} usersLoading={usersLoading} onBack={backFromLogin} onLogin={login} />
  return <Home onSelect={(nextHotel) => { setSelectedHotel(nextHotel); loadDirectory(nextHotel.id) }} onAdmin={() => setAdminStage('pin')} />
}
