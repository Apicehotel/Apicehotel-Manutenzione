import { useEffect, useMemo, useRef, useState } from 'react'
import { HOTELS, ROLE_PERMISSIONS, USERS } from './config.js'
import { clearSession, loadSession, saveSession } from './session.js'
import { isSupabaseConfigured } from './supabase.js'

const seededIssues = [
  { id: 1, hotelId: 'hotelgio', urgency: 'alta', room: '101 · Bagno', title: "Perdita d’acqua dal lavabo", status: 'todo', date: 'Oggi, 09:15', department: 'Governante', category: 'Idraulica', origin: 'App' },
  { id: 2, hotelId: 'hotelgio', urgency: 'media', room: '205 · Camera', title: 'Aria condizionata non raffredda', status: 'tecnico', date: 'Oggi, 10:30', department: 'Reception', category: 'Climatizzazione', origin: 'App' },
  { id: 3, hotelId: 'hotelgio', urgency: 'bassa', room: '301 · Balcone', title: 'Lampada esterna non funziona', status: 'attesa', date: 'Ieri, 16:45', department: 'Governante', category: 'Elettrica', origin: 'App' },
  { id: 4, hotelId: 'chocohotel', urgency: 'alta', room: 'Sala Colazione', title: 'Frigo buffet non raffredda', status: 'todo', date: 'Oggi, 08:20', department: 'Isola dei Golosi', category: 'Attrezzature', origin: 'App' },
  { id: 5, hotelId: 'brigantino', urgency: 'media', room: '204 · Camera', title: 'Cassaforte bloccata', status: 'done', date: 'Ieri, 18:10', department: 'Reception', category: 'Camera', origin: 'App' },
]

const Icon = ({ name }) => {
  const paths = {
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    arrow: <path d="m9 18 6-6-6-6"/>,
    logout: <><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M21 19V5a2 2 0 0 0-2-2h-6"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    tool: <path d="M14.7 6.3a4 4 0 0 0-5-5L12 3.6 9.6 6 7.3 3.7a4 4 0 0 0 5 5l-8.9 8.9a2.1 2.1 0 0 0 3 3l8.9-8.9a4 4 0 0 0-.6-5.4Z"/>,
  }
  return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function HotelMark({ hotel, large = false }) {
  return <span className={`hotel-mark ${hotel.tone} ${large ? 'large' : ''}`}>{hotel.mark}</span>
}

function Home({ onSelect }) {
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
        <div className="home-help"><span>Hai bisogno di aiuto?</span><span className="help-icon">?</span></div>
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
              <span className="showcase-card-inner">
                <span className="hotel-logo">
                  <img src={`/logos/${hotel.id === 'hotelgio' ? 'hotel-gio' : hotel.id === 'chocohotel' ? 'chocohotel' : 'hotel-brigantino'}.jpg`} alt={hotel.name} />
                </span>
                <span className="hotel-copy">
                  <small>Benvenuto in</small>
                  <strong>{hotel.id === 'hotelgio' ? <>Wine e<br />Jazz Area</> : hotel.id === 'chocohotel' ? <>ChocoHotel<br />Perugia</> : 'Hotel Brigantino'}</strong>
                  {hotel.id === 'brigantino' && <span>Porto Recanati</span>}
                </span>
              </span>
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

function Login({ hotel, onBack, onLogin }) {
  const allowed = USERS.filter((user) => user.hotels.includes(hotel.id))
  const [userId, setUserId] = useState(allowed[0]?.id || '')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  const submit = (event) => {
    event.preventDefault()
    const user = allowed.find((item) => item.id === userId)
    if (!user || pin.length !== 4 || user.pin !== pin) {
      setError('Utente o PIN non validi')
      return
    }
    onLogin(user)
  }

  return (
    <div className="page login-page">
      <button className="back-link" onClick={onBack}>‹ Cambia struttura</button>
      <main className="login-panel">
        <HotelMark hotel={hotel} large />
        <h1>{hotel.name}</h1>
        <form onSubmit={submit}>
          <label>Seleziona utente
            <select value={userId} onChange={(event) => setUserId(event.target.value)}>
              {allowed.map((user) => <option key={user.id} value={user.id}>{user.name} · {user.role}</option>)}
            </select>
          </label>
          <label>PIN di 4 cifre
            <input inputMode="numeric" autoComplete="current-password" maxLength="4" pattern="[0-9]{4}" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="••••" />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="primary" disabled={pin.length !== 4}>Accedi</button>
        </form>
        <aside className="session-note"><strong>Sessione persistente</strong><span>Il PIN non verrà richiesto di nuovo fino a logout, cambio utente o revoca.</span></aside>
      </main>
    </div>
  )
}

function AdminAccessTable() {
  return (
    <section className="admin-preview" aria-label="Matrice accessi multi-struttura">
      <h2>Accessi utenti</h2>
      <div className="table-wrap"><table><thead><tr><th>Utente</th><th>Ruolo</th>{HOTELS.map((hotel) => <th key={hotel.id}>{hotel.short}</th>)}</tr></thead>
        <tbody>{USERS.map((user) => <tr key={user.id}><td>{user.name}</td><td>{user.role}</td>{HOTELS.map((hotel) => <td key={hotel.id}><input type="checkbox" checked={user.hotels.includes(hotel.id)} readOnly aria-label={`${user.name}: ${hotel.name}`} /></td>)}</tr>)}</tbody>
      </table></div>
      <p>Anteprima del modello permessi; la gestione sarà collegata a Supabase Auth.</p>
    </section>
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

  const permissions = ROLE_PERMISSIONS[user.role] || []
  const issues = useMemo(() => seededIssues
    .filter((issue) => issue.hotelId === hotel.id && issue.status === status)
    .filter((issue) => !query || `${issue.room} ${issue.title}`.toLowerCase().includes(query.toLowerCase()))
    .filter((issue) => !department || issue.department === department)
    .filter((issue) => !category || issue.category === category)
    .sort((a, b) => {
      if (sort === 'camera') return a.room.localeCompare(b.room, 'it', { numeric: true })
      if (sort === 'data') return b.id - a.id
      const weight = { alta: 3, media: 2, bassa: 1 }
      return weight[b.urgency] - weight[a.urgency] || a.id - b.id
    }), [hotel.id, status, query, sort, department, category])

  return (
    <div className="operations">
      <header className="ops-header">
        <button className="hotel-switch" onClick={onChangeHotel}><HotelMark hotel={hotel} /><span><strong>{hotel.name}</strong><small>{user.name} · {user.role}</small></span></button>
        <button className={`presence ${presence ? 'on' : ''}`} onClick={() => setPresence(!presence)}><span /> Sono in struttura</button>
        <button className="icon-button" onClick={onLogout} title="Logout"><Icon name="logout" /></button>
      </header>
      <main className="ops-main">
        <div className="title-row"><div><h1>{tab}</h1><p>{isSupabaseConfigured ? 'Connesso a Supabase' : 'Dati demo · Supabase da configurare'}</p></div><span className="role-chip">{permissions.length} permessi</span></div>
        <nav className="tabs">{['Segnalazioni', 'Avvisi Urgenti', 'Interventi'].map((item) => <button className={tab === item ? 'active' : ''} key={item} onClick={() => setTab(item)}>{item}</button>)}</nav>
        {tab === 'Segnalazioni' ? <>
          <div className="status-tabs">{[['todo','Da fare'],['tecnico','Tecnico'],['attesa','Attesa pezzo'],['done','Completate']].map(([key,label]) => <button className={status === key ? 'active' : ''} key={key} onClick={() => setStatus(key)}>{label}</button>)}</div>
          <div className="toolbar"><label className="search"><Icon name="search"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cerca camera, zona o problema" /></label><select aria-label="Ordinamento" value={sort} onChange={(event) => setSort(event.target.value)}><option value="urgenza">Urgenza</option><option value="camera">Camera/Zona</option><option value="data">Data</option></select><button className="secondary" onClick={() => setAdvanced(!advanced)}>Filtri</button></div>
          {advanced && <div className="advanced-filters"><select value={department} onChange={(event) => setDepartment(event.target.value)}><option value="">Tutti i reparti</option><option>Governante</option><option>Reception</option><option>Isola dei Golosi</option></select><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">Tutte le categorie</option><option>Idraulica</option><option>Elettrica</option><option>Climatizzazione</option></select><select disabled><option>Origine: tutte</option></select><input type="date" aria-label="Data" /></div>}
          <section className="issue-list" aria-live="polite">{issues.length ? issues.map((issue) => <article className={`issue ${issue.urgency}`} key={issue.id}><span className="urgency">{issue.urgency}</span><div><h3>{issue.room}</h3><p>{issue.title}</p><small>{issue.department} · {issue.category} · {issue.date}</small></div><Icon name="arrow" /></article>) : <div className="empty"><strong>Nessuna segnalazione</strong><span>Non ci sono elementi con questi filtri.</span></div>}</section>
        </> : <div className="placeholder"><h2>{tab}</h2><p>Sezione predisposta per la prossima fase.</p></div>}
        {user.role === 'admin' && <AdminAccessTable />}
      </main>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(loadSession)
  const [selectedHotel, setSelectedHotel] = useState(() => HOTELS.find((hotel) => hotel.id === session?.hotelId) || null)
  const hotel = HOTELS.find((item) => item.id === session?.hotelId)
  const user = USERS.find((item) => item.id === session?.userId)

  const login = (nextUser) => {
    const next = { hotelId: selectedHotel.id, userId: nextUser.id, createdAt: Date.now() }
    saveSession(next)
    setSession(next)
  }
  const logout = () => { clearSession(); setSession(null); setSelectedHotel(null) }
  const changeHotel = () => { clearSession(); setSession(null); setSelectedHotel(null) }

  if (session && hotel && user && user.hotels.includes(hotel.id)) return <Operations hotel={hotel} user={user} onLogout={logout} onChangeHotel={changeHotel} />
  if (selectedHotel) return <Login hotel={selectedHotel} onBack={() => setSelectedHotel(null)} onLogin={login} />
  return <Home onSelect={setSelectedHotel} />
}
