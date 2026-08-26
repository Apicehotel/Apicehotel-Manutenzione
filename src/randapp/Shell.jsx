import { useEffect, useMemo, useState } from 'react'
import { HOTELS } from '../config.js'
import { fetchDirectory } from '../users-data.js'
import { Icon, IconButton, Sheet, EmptyState, UiSizeControl, ThemeControl } from './ui.jsx'
import { logoFor, hotelById, firstName } from './helpers.js'
import { buildNav, NAV_TARGET, VIEW_GUARDS } from './nav.js'
import Home from './Home.jsx'
import Issues from './Issues.jsx'
import Settings from './Settings.jsx'
import Profile from './Profile.jsx'
import PresenceChip from './PresenceChip.jsx'
import PlanningHub from './PlanningHub.jsx'
import InsertLauncher from './InsertLauncher.jsx'
import UrgentCreateSheet from './UrgentCreateSheet.jsx'
import GlobalUrgentAlert from './GlobalUrgentAlert.jsx'
import HousekeepingCompletionAlerts from './HousekeepingCompletionAlerts.jsx'
import './mobile-nav-tune.css'
import {
  InterventionsView, UrgentView,
  TemperatureView, HousekeepingView, TechnicianDirectoryView,
  FeedbackView, PinView, ManualView,
} from './MigratedViews.jsx'

const BOTTOM_NAV = [
  { id: 'issues', icon: 'issues', label: 'Segnalazioni' },
  { id: 'interventions', icon: 'wrench', label: 'Interventi' },
  { id: 'home', icon: 'home', label: 'Home' },
  { id: 'planning-work', icon: 'calendar', label: 'Planning' },
  { id: 'menu', icon: 'menu', label: 'Menu' },
]

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
  const [personalizeSignal, setPersonalizeSignal] = useState(0)
  const [drawer, setDrawer] = useState(false)
  const [hotelSheet, setHotelSheet] = useState(false)
  const [insertOpen, setInsertOpen] = useState(false)
  const [urgentCreateOpen, setUrgentCreateOpen] = useState(false)
  const [settings, setSettings] = useState(null)
  const [cacheBusy, setCacheBusy] = useState(false)
  const [cacheStatus, setCacheStatus] = useState('')
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

  const openHomePersonalize = () => {
    setDrawer(false)
    setView('home')
    setPersonalizeSignal((n) => n + 1)
  }

  const clearAppCache = async () => {
    if (cacheBusy) return
    const ok = window.confirm('Pulisci la cache dell’app? Sessione, PIN e preferenze resteranno invariati.')
    if (!ok) return
    setCacheBusy(true)
    setCacheStatus('Pulizia…')
    try {
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map((key) => caches.delete(key)))
      }
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations()
        await Promise.all(registrations.map((registration) => registration.update().catch(() => undefined)))
      }
      setCacheStatus('Cache pulita')
      window.setTimeout(() => window.location.reload(), 500)
    } catch (error) {
      console.error('Cache cleanup failed', error)
      setCacheStatus('Errore pulizia')
      setCacheBusy(false)
    }
  }

  const pickInsert = (id) => {
    setInsertOpen(false)
    if (id === 'issue') {
      setView('issues')
      setCreateSignal((n) => n + 1)
      return
    }
    if (id === 'urgent') {
      setUrgentCreateOpen(true)
      return
    }
    if (id === 'intervention') {
      setView('interventions')
      return
    }
    if (id === 'planning-work' || id === 'planning-sale') {
      setView('planning-work')
    }
  }

  if (settings !== null) return <Settings initialTab={settings} onExit={() => setSettings(null)} />

  const renderView = () => {
    if (view === 'home') return <Home user={user} hotel={hotel} personalizeSignal={personalizeSignal} onNavigate={(v) => pick({ id: v })} />
    if (view === 'issues') return <Issues user={user} hotel={hotel} users={users} createSignal={createSignal} />
    if (view === 'profile') return <Profile user={user} hotel={hotel} />

    const guard = VIEW_GUARDS[view]
    if (guard && user && !guard(user, hotel)) {
      return <EmptyState icon="lock" title="Accesso non consentito">Il tuo ruolo ({user.role}) non può usare questa sezione.</EmptyState>
    }

    if (view === 'interventions') return <InterventionsView user={user} hotel={hotel} />
    if (view === 'planning-work' || view === 'planning-sale') return <PlanningHub user={user} hotel={hotel} />
    if (view === 'urgent') return <UrgentView user={user} hotel={hotel} />
    if (view === 'temperature') return <TemperatureView hotel={hotel} />
    if (view === 'housekeeping') return <HousekeepingView user={user} hotel={hotel} />
    if (view === 'technicians') return <TechnicianDirectoryView users={users} hotel={hotel} />
    if (view === 'feedback-received') return <FeedbackView user={user} hotel={hotel} received />
    if (view === 'feedback') return <FeedbackView user={user} hotel={hotel} />
    if (view === 'pin') return <PinView user={user} />
    if (view === 'manual') return <ManualView />

    return <EmptyState icon="sparkles" title="Sezione non disponibile">Questa destinazione non è configurata.</EmptyState>
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

  const urgentHidden = drawer || hotelSheet || insertOpen || urgentCreateOpen

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
              <span className="rs-sidebar__label">Home</span>
              <button className="rs-sidebar__item" onClick={openHomePersonalize} data-testid="sidebar-personalize-home"><Icon name="sliders" /> <span>Personalizza Home</span></button>
              <span className="rs-sidebar__label">Tema</span>
              <ThemeControl />
              <span className="rs-sidebar__label">Dimensione interfaccia</span>
              <UiSizeControl />
              <span className="rs-sidebar__label">Sistema</span>
              <button className="rs-sidebar__item" onClick={clearAppCache} disabled={cacheBusy} data-testid="sidebar-clear-cache"><Icon name="refresh" /> <span>{cacheStatus || 'Pulisci cache'}</span></button>
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
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <PresenceChip user={user} />
            <IconButton icon="menu" label="Menu" onClick={() => setDrawer(true)} data-testid="header-menu" />
          </div>
        </header>

        <GlobalUrgentAlert hotel={hotel} user={user} hidden={urgentHidden} onOpen={() => setView('urgent')} />

        <main className="rs-content" data-testid="main-content"><HousekeepingCompletionAlerts />{renderView()}</main>

        <nav className="rs-bottomnav" data-testid="bottom-nav">
          {BOTTOM_NAV.map((item) => (
            <button key={item.id} className={`rs-navbtn ${view === item.id ? 'active' : ''}`}
              onClick={() => item.id === 'menu' ? setDrawer(true) : setView(item.id)} data-testid={`nav-${item.id}`}>
              <Icon name={item.icon} /><small>{item.label}</small>
            </button>
          ))}
        </nav>
        <button className="rs-navfab" onClick={() => setInsertOpen(true)} data-testid="fab-new" aria-label="Nuovo inserimento"><Icon name="plus" /></button>
      </div>

      <InsertLauncher open={insertOpen} onClose={() => setInsertOpen(false)} hotel={hotel} user={user} onPick={pickInsert} />
      <UrgentCreateSheet
        open={urgentCreateOpen}
        onClose={() => setUrgentCreateOpen(false)}
        hotel={hotel}
        user={user}
        onSaved={() => setView('urgent')}
      />

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
              <button className="rs-drawer__item" onClick={openHomePersonalize} data-testid="drawer-personalize-home">
                <Icon name="sliders" /> <span>Personalizza Home</span><i><Icon name="chevronRight" /></i>
              </button>
              <div className="rs-drawer__setting"><small>Tema</small><ThemeControl /></div>
              <div className="rs-drawer__setting"><small>Dimensione interfaccia</small><UiSizeControl /></div>
              <span className="rs-drawer__label">Sistema</span>
              <button className="rs-drawer__item" onClick={clearAppCache} disabled={cacheBusy} data-testid="drawer-clear-cache">
                <Icon name="refresh" /> <span>{cacheStatus || 'Pulisci cache'}</span><i><Icon name="chevronRight" /></i>
              </button>
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
