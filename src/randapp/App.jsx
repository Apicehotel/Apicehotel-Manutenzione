import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { HOTELS } from '../config.js'
import { loadSession, saveSession, clearSession } from '../session.js'
import { Button, Field, TextInput, Icon, Spinner } from './ui.jsx'
import { normalize, logoFor, hotelById, firstName } from './helpers.js'

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
  useEffect(() => { loadDirectoryAll().then(setDirectory).catch(() => setDirectory([])) }, [])
  const q = normalize(query)
  const suggestions = useMemo(() => {
    if (!q || matched) return []
    const starts = directory.filter((u) => normalize(u.name).startsWith(q))
    const contains = directory.filter((u) => {
      const name = normalize(u.name)
      return !name.startsWith(q) && name.includes(q)
    })
    return [...starts, ...contains].slice(0, 6)
  }, [directory, q, matched])

  const submit = async (e) => {
    e.preventDefault(); setError('')
    const user = matched || directory.find((u) => normalize(u.name) === q)
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
  const [pending, setPending] = useState(null)
  const [settingsFromLogin, setSettingsFromLogin] = useState(false)

  useEffect(() => {
    const onChange = () => setSession(loadSession())
    window.addEventListener(EVENT, onChange)
    return () => window.removeEventListener(EVENT, onChange)
  }, [])

  useEffect(() => {
    if (!session) return undefined
    let active = true
    const validate = async () => {
      if (!navigator.onLine) return
      try {
        const { validateSupabaseSession } = await import('../auth-data.js')
        const result = await validateSupabaseSession()
        if (active && !result.valid) {
          clearSession()
          setPending(null)
          setSession(null)
        }
      } catch (error) {
        console.warn('Controllo sessione rimandato', error)
      }
    }
    validate()
    window.addEventListener('online', validate)
    return () => { active = false; window.removeEventListener('online', validate) }
  }, [session?.hotelId, session?.userId])

  const onAuthenticated = ({ user, userId, allowedHotels, workedHotel }) => {
    if (allowedHotels.length <= 1) {
      saveSession({ hotelId: allowedHotels[0] || workedHotel, userId, createdAt: Date.now() })
      setSession(loadSession())
    } else {
      setPending({ user, userId, allowedHotels })
    }
  }

  const pickHotel = (hotelId) => {
    saveSession({ hotelId, userId: pending.userId, createdAt: Date.now() })
    setPending(null)
    setSession(loadSession())
  }

  const onLogout = async () => {
    const { signOutSupabase } = await import('../auth-data.js')
    await signOutSupabase()
    clearSession()
    setPending(null)
    setSession(null)
  }

  if (settingsFromLogin) return <AdminGate onBack={() => setSettingsFromLogin(false)} onExit={() => setSettingsFromLogin(false)} />
  if (session) return <Suspense fallback={<Spinner label="Avvio RandApp…" />}><Shell session={session} onLogout={onLogout} onSwitchHotel={(id) => { saveSession({ ...session, hotelId: id }); setSession(loadSession()) }} /></Suspense>
  if (pending) return <HotelSelector pending={pending} onPick={pickHotel} />
  return <Login onAuthenticated={onAuthenticated} onOpenSettings={() => setSettingsFromLogin(true)} />
}
