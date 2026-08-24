import { useEffect, useMemo, useState } from 'react'
import { HOTELS } from '../config.js'
import { fetchDirectory } from '../users-data.js'
import { Icon, IconButton, Sheet } from './ui.jsx'
import { logoFor, hotelById, firstName, can } from './helpers.js'
import Home from './Home.jsx'
import Issues from './Issues.jsx'
import Settings from './Settings.jsx'
import SoonScreen from './SoonScreen.jsx'

const NAV_ITEMS = [
  { id: 'issues', icon: 'issues', label: 'Segnalazioni' },
  { id: 'interventions', icon: 'wrench', label: 'Interventi' },
  { id: 'home', icon: 'home', label: 'Home' },
  { id: 'planning', icon: 'calendar', label: 'Planning' },
  { id: 'menu', icon: 'menu', label: 'Menu' },
]

const DRAWER_SECTIONS = [
  { id: 'urgent', icon: 'warning', label: 'Avvisi urgenti' },
  { id: 'interventions', icon: 'wrench', label: 'Planning lavori' },
  { id: 'planning', icon: 'calendar', label: 'Planning sale' },
  { id: 'temperature', icon: 'thermometer', label: 'Temperature' },
  { id: 'housekeeping', icon: 'housekeeping', label: 'Housekeeping' },
  { id: 'technicians', icon: 'phone', label: 'Rubrica tecnici' },
]

const SIDEBAR_ITEMS = [
  { id: 'home', icon: 'home', label: 'Home' },
  { id: 'issues', icon: 'issues', label: 'Segnalazioni' },
  { id: 'interventions', icon: 'wrench', label: 'Interventi' },
  { id: 'planning', icon: 'calendar', label: 'Planning sale' },
  { id: 'housekeeping', icon: 'housekeeping', label: 'Housekeeping' },
  { id: 'temperature', icon: 'thermometer', label: 'Temperature' },
  { id: 'urgent', icon: 'warning', label: 'Avvisi urgenti' },
]

const SOON_META = {
  interventions: { icon: 'wrench', title: 'Planning lavori', desc: 'Gli interventi pianificati verranno migrati qui nel prossimo passaggio, con lo stesso layout Dark Shell.' },
  planning: { icon: 'calendar', title: 'Planning sale', desc: 'La pianificazione sale sarà collegata alla logica esistente mantenendo questo design system.' },
  temperature: { icon: 'thermometer', title: 'Temperature', desc: 'I sensori eWeLink saranno migrati qui riusando i servizi già presenti.' },
  housekeeping: { icon: 'housekeeping', title: 'Housekeeping', desc: 'La gestione camere sarà collegata mantenendo la logica attuale.' },
  urgent: { icon: 'warning', title: 'Avvisi urgenti', desc: 'La sirena e la gestione avvisi verranno migrate qui senza rifare il layout.' },
  technicians: { icon: 'phone', title: 'Rubrica tecnici', desc: 'La rubrica dei tecnici esterni sarà collegata nel prossimo passaggio.' },
}

export default function Shell({ session, onLogout, onSwitchHotel }) {
  const [user, setUser] = useState(null)
  const [users, setUsers] = useState([])
  const [view, setView] = useState('home')
  const [drawer, setDrawer] = useState(false)
  const [hotelSheet, setHotelSheet] = useState(false)
  const [settings, setSettings] = useState(false)
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

  if (settings) return <Settings onExit={() => setSettings(false)} />

  const goto = (next) => { setView(next); setDrawer(false) }

  const renderView = () => {
    if (view === 'home') return <Home user={user} hotel={hotel} onNavigate={goto} />
    if (view === 'issues') return <Issues user={user} hotel={hotel} users={users} />
    const meta = SOON_META[view] || { icon: 'sparkles', title: 'RandApp', desc: 'Sezione in arrivo.' }
    return <SoonScreen {...meta} />
  }

  return (
    <div className="rs-root">
      <div className="rs-app rs-app--with-side">
        <aside className="rs-sidebar">
          <div className="rs-sidebar__brand">
            <img src={logoFor(hotel.id)} alt={hotel.name} />
            <div><b>RandApp</b><small>{hotel.name}</small></div>
          </div>
          {SIDEBAR_ITEMS.map((item) => (
            <button key={item.id} className={`rs-sidebar__item ${view === item.id ? 'active' : ''}`} onClick={() => setView(item.id)} data-testid={`side-nav-${item.id}`}>
              <Icon name={item.icon} /> {item.label}
            </button>
          ))}
          <div className="rs-sidebar__spacer" />
          {(can(user, 'manage_users') || user?.can_access_admin) && (
            <button className="rs-sidebar__item" onClick={() => setSettings(true)} data-testid="side-nav-settings"><Icon name="gear" /> Impostazioni</button>
          )}
          <button className="rs-sidebar__item" onClick={onLogout} data-testid="side-nav-logout"><Icon name="logout" /> Esci</button>
        </aside>

        <header className="rs-header">
          <button className="rs-hotelchip" onClick={() => setHotelSheet(true)} data-testid="hotel-chip">
            <img src={logoFor(hotel.id)} alt={hotel.name} />
            <span className="rs-hotelchip__text">
              <b>{hotel.name}</b>
              <small>{user ? `${firstName(user.name)} · ${user.role || ''}` : 'Caricamento…'}</small>
            </span>
            {allowedHotels.length > 1 && <span className="rs-hotelchip__caret"><Icon name="chevronDown" /></span>}
          </button>
          <IconButton icon="bell" label="Notifiche" onClick={() => goto('urgent')} data-testid="header-bell" />
          <IconButton icon="menu" label="Menu" onClick={() => setDrawer(true)} data-testid="header-menu" />
        </header>

        <main className="rs-content" data-testid="main-content">{renderView()}</main>

        <nav className="rs-bottomnav" data-testid="bottom-nav">
          {NAV_ITEMS.map((item) => (
            <button key={item.id} className={`rs-navbtn ${view === item.id ? 'active' : ''}`}
              onClick={() => item.id === 'menu' ? setDrawer(true) : setView(item.id)} data-testid={`nav-${item.id}`}>
              <Icon name={item.icon} /><small>{item.label}</small>
            </button>
          ))}
        </nav>
        {view === 'issues' ? null : (
          <button className="rs-navfab" onClick={() => setView('issues')} data-testid="fab-new" aria-label="Nuova segnalazione"><Icon name="plus" /></button>
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
            <div className="rs-drawer__head">
              <img src={logoFor(hotel.id)} alt="" />
              <div><b>{user ? user.name : 'RandApp'}</b><small>{user?.role || 'Manutenzione'}</small></div>
              <IconButton icon="close" label="Chiudi" onClick={() => setDrawer(false)} style={{ marginLeft: 'auto' }} />
            </div>
            <span className="rs-drawer__label">Operatività</span>
            {DRAWER_SECTIONS.map((item) => (
              <button key={item.id} className="rs-drawer__item" onClick={() => goto(item.id)} data-testid={`drawer-${item.id}`}>
                <Icon name={item.icon} /> <span>{item.label}</span> <i><Icon name="chevronRight" /></i>
              </button>
            ))}
            <div className="rs-drawer__spacer" />
            {(can(user, 'manage_users') || user?.can_access_admin) && (
              <button className="rs-drawer__item" onClick={() => { setDrawer(false); setSettings(true) }} data-testid="drawer-settings">
                <Icon name="gear" /> <span>Impostazioni</span> <i><Icon name="chevronRight" /></i>
              </button>
            )}
            <button className="rs-drawer__item rs-drawer__item--danger" onClick={onLogout} data-testid="drawer-logout">
              <Icon name="logout" /> <span>Esci</span>
            </button>
          </aside>
        </div>
      )}
    </div>
  )
}
