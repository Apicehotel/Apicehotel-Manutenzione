import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { HOTELS } from '../config.js'
import { loadSession, saveSession, clearSession } from '../session.js'
import { isOfflineSessionFresh, markSessionValidated } from '../session-policy.js'
import { Button, Field, TextInput, Icon, Spinner } from './ui.jsx'
import { normalize, logoFor, hotelById, firstName } from './helpers.js'
import PinRecoveryComplete, { PinRecoveryRequest } from './PinRecovery.jsx'

const Shell = lazy(() => import('./Shell.jsx'))
const Settings = lazy(() => import('./Settings.jsx'))

const EVENT = 'apice-session-changed'

async function loadDirectoryAll() {
  const { fetchDirectory } = await import('../users-data.js')
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
  return Array.from(map.values()).sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'it'))
}

function BrandMark({ tagline = true }) {
  return (
    <div className="rs-brand">
      <div className="rs-brand__logo"><img src="/logos/apicehotel-mascot.png" alt="ApiceHotel" /></div>
      <div>
        <h1 className="rs-brand__title">RandApp</h1>
        <p className="rs-brand__sub">Manutenzione</p>
        {tagline && <p className="rs-brand__tag"><Icon name="sparkles" /> Gestione e manutenzione delle strutture</p>}
      </div>
    </div>
  )
}

function AdminGate({ onBack, onExit }) {
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState(false)
  const submit = async (e) => {
    e.preventDefault(); setError(''); setBusy(true)
    try { const { loginAdmin } = await import('../auth-data.js'); await loginAdmin(pin); setOk(true) }
    catch { setError('PIN amministratore non valido') }
    finally { setBusy(false) }
  }
  if (ok) return <Suspense fallback={<Spinner label="Carico impostazioni…" />}><Settings onExit={onExit || onBack} /></Suspense>
  return (
    <main className="rs-auth">
      <div className="rs-auth__inner">
        <BrandMark tagline={false} />
        <section className="rs-card rs-authcard">
          <button className="rs-textback" onClick={onBack}><Icon name="chevronLeft" /> RandApp</button>
          <header><h1>Impostazioni</h1><p>Accesso protetto amministratore</p></header>
          <form className="rs-authform" onSubmit={submit}>
            <Field label="PIN amministratore">
              <TextInput icon="lock" value={pin} inputMode="numeric" autoComplete="current-password" placeholder="••••••" data-testid="admin-pin-input"
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} />
            </Field>
            {error && <p className="rs-error" role="alert">{error}</p>}
            <Button variant="primary" size="lg" className="rs-btn--block" disabled={busy || pin.length < 6} data-testid="admin-gate-submit" iconRight="arrowRight">
              {busy ? 'ACCESSO…' : 'ENTRA'}
            </Button>
          </form>
        </section>
      </div>
    </main>
  )
}

function Login({ onAuthenticated, onOpenSettings }) {
  const [directory, setDirectory] = useState([])
  const [query, setQuery] = useState('')
  const [matched, setMatched] = useState(null)
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [recovering, setRecovering] = useState(false)
  useEffect(() => { loadDirectoryAll().then(setDirectory).catch(() => setDirectory([])) }, [])
  const q = normalize(query)
  const selectedUser = matched || directory.find((u) => normalize(u.name) === q) || null
  const suggestions = useMemo(() => (
    q && !matched
      ? directory.filter((u) => normalize(u.name).startsWith(q)).slice(0, 6)
      : []
  ), [directory, q, matched])

  const submit = async (e) => {
    e.preventDefault(); setError('')
    const user = selectedUser
    if (!user) return setError('Seleziona un utente valido dalla lista')
    if (pin.length !== 4) return setError('Inserisci un PIN di 4 cifre')
    const hotels = Array.from(new Set([...(user.hotels || []), ...(Array.isArray(user.hotels) ? user.hotels : [])])).filter(Boolean)
    if (!hotels.length) return setError('Nessuna struttura abilitata per questo utente')
    setBusy(true)
    let lastError = null
    for (const hotelId of hotels) {
      try {
        const { loginWithPin } = await import('../auth-data.js')
        const auth = await loginWithPin({ hotelId, userId: user.legacy_id || user.id, pin })
        const userId = auth?.user?.id || user.id
        onAuthenticated({ user, userId, allowedHotels: hotels, workedHotel: hotelId })
        return
      } catch (err) { lastError = err }
    }
    console.warn('Login RandApp fallito', lastError)
    setError('Utente o PIN non validi')
    setBusy(false)
  }

  if (recovering && selectedUser) return <PinRecoveryRequest user={selectedUser} onBack={() => setRecovering(false)} />

  return (
    <main className="rs-auth">
      <div className="rs-auth__inner">
        <BrandMark />
        <section className="rs-card rs-authcard">
          <header><h1>Bentornato</h1><p>Accedi per continuare</p></header>
          <form className="rs-authform" onSubmit={submit}>
            <Field label="Utente">
              <div className="rs-autocomplete">
                <TextInput icon="user" value={query} placeholder="Scrivi il tuo nome" autoComplete="username" data-testid="login-user-input"
                  onFocus={() => setOpen(true)}
                  onBlur={() => setTimeout(() => setOpen(false), 150)}
                  onChange={(e) => { setQuery(e.target.value); setMatched(null); setError(''); setOpen(true) }} />
                {open && suggestions.length > 0 && (
                  <div className="rs-suggest" data-testid="login-suggestions">
                    {suggestions.map((u) => (
                      <button type="button" key={u.id || u.name} onMouseDown={(ev) => { ev.preventDefault(); setMatched(u); setQuery(u.name); setOpen(false) }}>
                        <b>{u.name}</b><small>{u.role || ''}</small>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Field>
            <Field label="PIN">
              <TextInput icon="lock" value={pin} inputMode="numeric" autoComplete="current-password" placeholder="••••" data-testid="login-pin-input"
                onChange={(e) => { setPin(e.target.value.replace(/\D/g, '').slice(0, 4)); setError('') }} />
            </Field>
            {selectedUser && <button type="button" className="rs-textback" onClick={() => setRecovering(true)} data-testid="pin-forgot-link">PIN dimenticato?</button>}
            {error && <p className="rs-error" role="alert" data-testid="login-error">{error}</p>}
            <Button variant="primary" size="lg" className="rs-btn--block" disabled={busy} data-testid="login-submit" iconRight="arrowRight">
              {busy ? 'ACCESSO…' : 'ACCEDI'}
            </Button>
          </form>
          <div className="rs-divider"><span>oppure</span></div>
          <button className="rs-settings-link" onClick={onOpenSettings} data-testid="open-settings-link">
            <Icon name="gear" />
            <span><b>Impostazioni</b><small>Configura l'app e le preferenze</small></span>
            <i><Icon name="chevronRight" /></i>
          </button>
        </section>
      </div>
    </main>
  )
}

function HotelSelector({ pending, onPick }) {
  const hotels = (pending.allowedHotels || []).map(hotelById).filter(Boolean)
  return (
    <main className="rs-hotelselect">
      <div className="rs-hotelselect__head">
        <BrandMark tagline={false} />
        <h1>Ciao {firstName(pending.user?.name)}</h1>
        <p>Scegli la struttura con cui vuoi lavorare</p>
      </div>
      <div className="rs-hotelselect__grid" data-testid="hotel-selector">
        {hotels.map((h) => (
          <button key={h.id} className="rs-hotel-option" onClick={() => onPick(h.id)} data-testid={`hotel-option-${h.id}`}>
            <img src={logoFor(h.id)} alt={h.name} />
            <span className="rs-hotel-option__text"><b>{h.name}</b><small>Accedi all'area operativa</small></span>
            <i><Icon name="arrowRight" /></i>
          </button>
        ))}
      </div>
    </main>
  )
}

export default function App() {
  const [session, setSession] = useState(loadSession())
  const [sessionReady, setSessionReady] = useState(() => !loadSession())
  const [pending, setPending] = useState(null)
  const [settingsFromLogin, setSettingsFromLogin] = useState(false)
  const recoveryToken = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('pinRecovery') : null
  const [recoveryDone, setRecoveryDone] = useState(false)

  useEffect(() => {
    const onChange = () => setSession(loadSession())
    window.addEventListener(EVENT, onChange)
    return () => window.removeEventListener(EVENT, onChange)
  }, [])

  useEffect(() => {
    if (!session) {
      setSessionReady(true)
      return undefined
    }
    let active = true
    setSessionReady(false)
    const resetSession = async (signOutSupabase) => {
      try { await signOutSupabase?.() } catch { /* local reset still proceeds */ }
      clearSession()
      if (!active) return
      setPending(null)
      setSession(null)
      setSessionReady(true)
    }
    const validate = async () => {
      if (!navigator.onLine) {
        if (!isOfflineSessionFresh(session)) {
          console.warn('Sessione offline scaduta: nuovo accesso richiesto')
          await resetSession()
          return
        }
        if (active) setSessionReady(true)
        return
      }
      try {
        const { validateSupabaseSession, signOutSupabase } = await import('../auth-data.js')
        const result = await validateSupabaseSession()
        if (active && !result.valid) {
          await resetSession(signOutSupabase)
          return
        }
        if (!active) return
        const { fetchDirectory } = await import('../users-data.js')
        const directory = await fetchDirectory(session.hotelId)
        if (!active) return
        const rows = directory?.users || []
        const authorized = rows.some((u) => u.auth_user_id === session.userId || u.id === session.userId || u.legacy_id === session.userId)
        if (!authorized) {
          console.warn('Sessione RandApp non più associata alla struttura: accesso ripristinato')
          await resetSession(signOutSupabase)
          return
        }
        const validatedSession = markSessionValidated(session)
        saveSession(validatedSession)
        if (active) setSessionReady(true)
      } catch (error) {
        console.warn('Controllo sessione rimandato', error)
        if (isOfflineSessionFresh(session)) {
          if (active) setSessionReady(true)
        } else {
          await resetSession()
        }
      }
    }
    validate()
    window.addEventListener('online', validate)
    return () => { active = false; window.removeEventListener('online', validate) }
  }, [session?.hotelId, session?.userId])

  const onAuthenticated = ({ user, userId, allowedHotels, workedHotel }) => {
    const now = Date.now()
    if (allowedHotels.length <= 1) {
      saveSession({ hotelId: allowedHotels[0] || workedHotel, userId, createdAt: now, lastValidatedAt: now })
      setSession(loadSession())
      setSessionReady(false)
    } else {
      setPending({ user, userId, allowedHotels, validatedAt: now })
    }
  }

  const pickHotel = (hotelId) => {
    const now = Date.now()
    saveSession({ hotelId, userId: pending.userId, createdAt: now, lastValidatedAt: pending.validatedAt || now })
    setPending(null)
    setSession(loadSession())
    setSessionReady(false)
  }

  const onLogout = async () => {
    const { signOutSupabase } = await import('../auth-data.js')
    await signOutSupabase()
    clearSession()
    setPending(null)
    setSession(null)
    setSessionReady(true)
  }

  if (recoveryToken && !recoveryDone) return <PinRecoveryComplete token={recoveryToken} onDone={() => { setRecoveryDone(true); try { window.history.replaceState({}, '', window.location.pathname) } catch { /* noop */ } }} />
  if (settingsFromLogin) return <AdminGate onBack={() => setSettingsFromLogin(false)} onExit={() => setSettingsFromLogin(false)} />
  if (session && !sessionReady) return <Spinner label="Verifico accesso…" />
  if (session) return <Suspense fallback={<Spinner label="Avvio RandApp…" />}><Shell session={session} onLogout={onLogout} onSwitchHotel={(id) => { saveSession({ ...session, hotelId: id }); setSession(loadSession()); setSessionReady(false) }} /></Suspense>
  if (pending) return <HotelSelector pending={pending} onPick={pickHotel} />
  return <Login onAuthenticated={onAuthenticated} onOpenSettings={() => setSettingsFromLogin(true)} />
}
