import { useEffect, useMemo, useState } from 'react'
import { HOTELS } from '../config.js'
import { fetchDirectory } from '../users-data.js'
import { Icon, IconButton, Sheet, Button, EmptyState, UiSizeControl, ThemeControl } from './ui.jsx'
import { logoFor, hotelById, firstName } from './helpers.js'
import { buildNav, NAV_TARGET, VIEW_GUARDS } from './nav.js'
import Home from './Home.jsx'
import Issues from './Issues.jsx'
import Settings from './Settings.jsx'
import Profile from './Profile.jsx'
import SoonScreen from './SoonScreen.jsx'

const BOTTOM_NAV = [
  { id: 'issues', icon: 'issues', label: 'Segnalazioni' },
  { id: 'interventions', icon: 'wrench', label: 'Interventi' },
  { id: 'home', icon: 'home', label: 'Home' },
  { id: 'planning-work', icon: 'calendar', label: 'Planning' },
  { id: 'menu', icon: 'menu', label: 'Menu' },
]

const SOON_META = {
  interventions: { icon: 'wrench', title: 'Interventi', desc: 'Le attività pianificate e assegnate verranno collegate qui riusando la logica esistente (planned-data).' },
  'planning-work': { icon: 'calendar', title: 'Planning lavori', desc: 'La pianificazione lavori sarà migrata mantenendo questo design system.' },
  'planning-sale': { icon: 'calendar', title: 'Planning sale', desc: 'La pianificazione sale (Hotel Giò) sarà collegata alla logica esistente.' },
  temperature: { icon: 'thermometer', title: 'Temperature', desc: 'Le letture dei sensori eWeLink saranno migrate qui riusando i servizi già presenti.' },
  housekeeping: { icon: 'housekeeping', title: 'Housekeeping', desc: 'La gestione camere sarà collegata mantenendo la logica attuale.' },
  urgent: { icon: 'warning', title: 'Avvisi urgenti', desc: 'La gestione avvisi e la sirena verranno migrate qui senza rifare il layout.' },
  technicians: { icon: 'phone', title: 'Rubrica tecnici', desc: 'La rubrica dei tecnici esterni sarà collegata nel prossimo passaggio.' },
  'feedback-received': { icon: 'message', title: 'Feedback ricevuti', desc: 'La bacheca feedback per gli amministratori sarà migrata qui.' },
  profile: { icon: 'user', title: 'Il mio profilo', desc: 'Dati profilo, email e telefono. Sezione in migrazione nel Dark Shell.' },
  pin: { icon: 'lock', title: 'Cambia PIN', desc: 'Cambio del PIN personale. Sezione in migrazione nel Dark Shell.' },
  manual: { icon: 'book', title: 'Manuale', desc: 'Guida rapida all\'uso dell\'app. Sezione in migrazione.' },
  feedback: { icon: 'message', title: 'Invia feedback', desc: 'Invia suggerimenti e segnalazioni sull\'app. Sezione in migrazione.' },
}

function NavGroups({ user, hotel, variant, current, onPick }) {
  const groups = useMemo(() => buildNav(user, hotel), [user, hotel])
  const itemCls = variant === 'sidebar' ? 'rs-sidebar__item' : 'rs-drawer__item'
  return (
    <>
      {groups.map((group) => (
        <div key={group.id} className={variant === 'sidebar' ? 'rs-sidebar__group' : ''}>
          <span className={variant === 'sidebar' ? 'rs-sidebar__label' : 'rs-drawer__label'}>{group.label}</span>
          {group.items.map((item) => (
            <button key={item.id} className={`${itemCls} ${current === item.id ? 'active' : ''}`} onClick={() => onPick(item)} data-testid={`${variant}-${item.id}`}>
              <Icon name={item.icon} /> <span>{item.label}</span>
              {variant === 'drawer' && <i><Icon name="chevronRight" /></i>}
            </button>
          ))}
        </div>
      ))}
    </>
  )
}

export default function Shell({ session, onLogout, onSwitchHotel }) {
  const [user, setUser] = useState(null)
  const [users, setUsers] = useState([])
  const [view, setView] = useState('home')
  const [createSignal, setCreateSignal] = useState(0)
  const [drawer, setDrawer] = useState(false)
  const [hotelSheet, setHotelSheet] = useState(false)
  const [settings, setSettings] = useState(null) // null | tab id
  const hotel = hotelById(session.hotelId) || HOTELS[0]

  useEffect(() => {
    let active = true
    fetchDirectory(session.hotelId).then(({ users: list }) => {
      if (!active) return
      const rows = list || []
      setUsers(rows)
      setUser(rows.find((u) => u.auth_user_id === session.userId || u.id === session.userId || u.legacy_id === session.userId) || rows[0] || null)
    }).catch(() => {})
    return () => { active = false }
  }, [session.hotelId, session.userId])

  const allowedHotels = useMemo(() => {
    const set = new Set([session.hotelId, ...(user?.hotels || [])])
    return Array.from(set).filter(Boolean)
  }, [session.hotelId, user])

  const pick = (item) => {
    setDrawer(false)
    const target = NAV_TARGET[item.id]
    if (target?.settings) { setSettings(target.settings); return }
    if (target?.view) { setView(target.view); if (target.create) setCreateSignal((n) => n + 1); return }
    setView(item.id)
  }

  if (settings !== null) return <Settings initialTab={settings} onExit={() => setSettings(null)} />

  const renderView = () => {
    if (view === 'home') return <Home user={user} hotel={hotel} onNavigate={(v) => pick({ id: v })} />
    if (view === 'issues') return <Issues user={user} hotel={hotel} users={users} createSignal={createSignal} />
    if (view === 'profile') return <Profile user={user} hotel={hotel} />
    const guard = VIEW_GUARDS[view]
    if (guard && user && !guard(user, hotel)) {
      return <EmptyState icon="lock" title="Accesso non consentito">Il tuo ruolo ({user.role}) non può usare questa sezione.</EmptyState>
    }
    const meta = SOON_META[view] || { icon: 'sparkles', title: 'RandApp', desc: 'Sezione in arrivo.' }
    return <SoonScreen {...meta} />
  }

  const DrawerHeader = (
    <div className="rs-drawer__head">
      <img src={logoFor(hotel.id)} alt="" />
      <div style={{ minWidth: 0 }}>
        <b>{hotel.name}</b>
        <small>{user ? `${user.name} · ${user.role}` : 'Manutenzione'}</small>
      </div>
      <IconButton icon="close" label="Chiudi" onClick={() => setDrawer(false)} style={{ marginLeft: 'auto' }} />
    </div>
  )

  return (
    <div className="rs-root">
      <div className="rs-app rs-app--with-side">
        <aside className="rs-sidebar" data-testid="sidebar">
          <div className="rs-sidebar__brand">
            <img src={logoFor(hotel.id)} alt={hotel.name} />
            <div style={{ minWidth: 0 }}><b>RandApp</b><small>{hotel.name}</small></div>
          </div>
          {allowedHotels.length > 1 && (
            <button className="rs-sidebar__switch" onClick={() => setHotelSheet(true)} data-testid="sidebar-switch-hotel">
              <Icon name="hotel" /> <span>Cambia struttura</span> <i><Icon name="chevronDown" /></i>
            </button>
          )}
          <div className="rs-sidebar__scroll">
            <NavGroups user={user} hotel={hotel} variant="sidebar" current={view} onPick={pick} />
            <div className="rs-sidebar__prefs">
              <span className="rs-sidebar__label">Tema</span>
              <ThemeControl />
              <span className="rs-sidebar__label">Dimensione interfaccia</span>
              <UiSizeControl />
            </div>
          </div>
          <button className="rs-sidebar__item" onClick={onLogout} data-testid="sidebar-logout"><Icon name="logout" /> Esci</button>
        </aside>

        <header className="rs-header">
          <button className="rs-hotelchip" onClick={() => allowedHotels.length > 1 ? setHotelSheet(true) : setDrawer(true)} data-testid="hotel-chip">
            <img src={logoFor(hotel.id)} alt={hotel.name} />
            <span className="rs-hotelchip__text">
              <b>{hotel.name}</b>
              <small>{user ? `${firstName(user.name)} · ${user.role || ''}` : 'Caricamento…'}</small>
            </span>
            {allowedHotels.length > 1 && <span className="rs-hotelchip__caret"><Icon name="chevronDown" /></span>}
          </button>
          <IconButton icon="menu" label="Menu" onClick={() => setDrawer(true)} data-testid="header-menu" />
        </header>

        <main className="rs-content" data-testid="main-content">{renderView()}</main>

        <nav className="rs-bottomnav" data-testid="bottom-nav">
          {BOTTOM_NAV.map((item) => (
            <button key={item.id} className={`rs-navbtn ${view === item.id ? 'active' : ''}`}
              onClick={() => item.id === 'menu' ? setDrawer(true) : setView(item.id)} data-testid={`nav-${item.id}`}>
              <Icon name={item.icon} /><small>{item.label}</small>
            </button>
          ))}
        </nav>
        {view !== 'issues' && (
          <button className="rs-navfab" onClick={() => { setView('issues'); setCreateSignal((n) => n + 1) }} data-testid="fab-new" aria-label="Nuova segnalazione"><Icon name="plus" /></button>
        )}
      </div>

      <Sheet open={hotelSheet} onClose={() => setHotelSheet(false)} title="Cambia struttura">
        {allowedHotels.map((id) => {
          const h = hotelById(id)
          if (!h) return null
          return (
            <button key={id} className={`rs-hotelrow ${id === hotel.id ? 'selected' : ''}`} data-testid={`switch-hotel-${id}`}
              onClick={() => { onSwitchHotel(id); setHotelSheet(false) }}>
              <img src={logoFor(id)} alt={h.name} />
              <span><b>{h.name}</b><small>{id === hotel.id ? 'Struttura attiva' : 'Passa a questa struttura'}</small></span>
              <i>{id === hotel.id ? <Icon name="check" /> : <Icon name="chevronRight" />}</i>
            </button>
          )
        })}
      </Sheet>

      {drawer && (
        <div className="rs-overlay" onClick={() => setDrawer(false)} style={{ justifyContent: 'flex-end' }}>
          <aside className="rs-drawer" onClick={(e) => e.stopPropagation()} data-testid="drawer">
            {DrawerHeader}
            {allowedHotels.length > 1 && (
              <button className="rs-drawer__switch" onClick={() => { setDrawer(false); setHotelSheet(true) }} data-testid="drawer-switch-hotel">
                <Icon name="hotel" /> <span>Cambia struttura</span> <i><Icon name="chevronRight" /></i>
              </button>
            )}
            <div className="rs-drawer__scroll">
              <NavGroups user={user} hotel={hotel} variant="drawer" current={view} onPick={pick} />
              <span className="rs-drawer__label">Preferenze</span>
              <div className="rs-drawer__setting">
                <small>Tema</small>
                <ThemeControl />
              </div>
              <div className="rs-drawer__setting">
                <small>Dimensione interfaccia</small>
                <UiSizeControl />
              </div>
            </div>
            <button className="rs-drawer__item rs-drawer__item--danger" onClick={onLogout} data-testid="drawer-logout">
              <Icon name="logout" /> <span>Esci</span>
            </button>
          </aside>
        </div>
      )}
    </div>
  )
}
