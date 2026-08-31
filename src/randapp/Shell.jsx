import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { fetchDirectory } from '../users-data.js'
import { Icon, IconButton, Sheet, EmptyState, Spinner, UiSizeControl, ThemeControl } from './ui.jsx'
import { canCreatePlanned, canSendUrgent, logoFor, hotelById } from './helpers.js'
import { canUser } from '../permissions.js'
import { buildNav, NAV_TARGET, VIEW_GUARDS } from './nav.js'
import { fetchRoleNavigation, placementFor, subscribeRoleNavigation, VIEW_TO_NAV_KEY } from './role-navigation.js'
import Home from './Home.jsx'
import PresenceChip from './PresenceChip.jsx'
import GlobalUrgentAlert from './GlobalUrgentAlert.jsx'
import HousekeepingCompletionAlerts from './HousekeepingCompletionAlerts.jsx'
import './mobile-nav-tune.css'
import './new-issue-compact.css'
import './header-mobile.css'

const Settings = lazy(() => import('./Settings.jsx'))
const Issues = lazy(() => import('./Issues.jsx'))
const InventoryView = lazy(() => import('./InventoryView.jsx'))
const Profile = lazy(() => import('./Profile.jsx'))
const PlanningHub = lazy(() => import('./PlanningHub.jsx'))
const RemindersView = lazy(() => import('./reminders/RemindersView.jsx'))
const NotificationInbox = lazy(() => import('./notifications/NotificationInbox.jsx'))
const InsertLauncher = lazy(() => import('./InsertLauncher.jsx'))
const UrgentCreateSheet = lazy(() => import('./UrgentCreateSheet.jsx'))
const InterventionsView = lazy(() => import('./operations/InterventionsView.jsx'))
const UrgentView = lazy(() => import('./operations/UrgentView.jsx'))
const MyWorkView = lazy(() => import('./operations/MyWorkView.jsx'))
const TemperatureView = lazy(() => import('../temperature.jsx').then(({ TemperatureSensors }) => ({
  default: ({ hotel }) => <div className="rs-legacy rs-legacy--temperature" data-testid="temperature-view"><TemperatureSensors hotel={hotel} /></div>,
})))
const PlantView = lazy(() => import('../temperature.jsx').then(({ PlantStatus }) => ({
  default: ({ hotel }) => <div className="rs-legacy rs-legacy--temperature" data-testid="plants-view"><PlantStatus hotel={hotel} /></div>,
})))
const HousekeepingView = lazy(() => import('../housekeeping.jsx').then(({ Housekeeping }) => ({
  default: ({ hotel, user }) => <div className="rs-legacy rs-legacy--housekeeping" data-testid="housekeeping-view"><Housekeeping hotel={hotel} user={user} /></div>,
})))
const TechnicianDirectoryView = lazy(() => import('./operations/UtilityLightViews.jsx').then((module) => ({ default: module.TechnicianDirectoryView })))
const FeedbackView = lazy(() => import('./operations/UtilityLightViews.jsx').then((module) => ({ default: module.FeedbackView })))
const PinView = lazy(() => import('./operations/UtilityLightViews.jsx').then((module) => ({ default: module.PinView })))
const ManualView = lazy(() => import('./operations/UtilityLightViews.jsx').then((module) => ({ default: module.ManualView })))

const ViewFallback = () => <Spinner label="Carico sezione…" />
const HEADER_HOTEL_LABEL = { hotelgio: 'Giò', chocohotel: 'Choco', brigantino: 'Brigantino' }

const NAV_BUTTONS = [
  { id: 'issues', key: 'issues', icon: 'issues', label: 'Segnalazioni' },
  { id: 'interventions', key: 'interventions', icon: 'wrench', label: 'Interventi' },
  { id: 'inventory', key: 'inventory', icon: 'package', label: 'Magazzino' },
  { id: 'home', key: 'home', icon: 'home', label: 'Home' },
  { id: 'planning-work', key: 'planning_work', icon: 'calendar', label: 'Planning' },
  { id: 'housekeeping', key: 'housekeeping', icon: 'housekeeping', label: 'Housekeeping' },
  { id: 'urgent', key: 'urgent', icon: 'warning', label: 'Urgenti' },
  { id: 'reminders', key: 'reminders', icon: 'bell', label: 'Promemoria' },
  { id: 'temperature', key: 'temperature', icon: 'thermometer', label: 'Temperature' },
  { id: 'technicians', key: 'technicians', icon: 'phone', label: 'Tecnici' },
  { id: 'profile', key: 'profile', icon: 'user', label: 'Profilo' },
  { id: 'manual', key: 'manual', icon: 'book', label: 'Manuale' },
  { id: 'feedback', key: 'feedback', icon: 'message', label: 'Feedback' },
  { id: 'feedback-received', key: 'feedback_received', icon: 'message', label: 'Ricevuti' },
  { id: 'structure', key: 'structure', icon: 'hotel', label: 'Struttura' },
  { id: 'menu', key: 'other', icon: 'menu', label: 'Menu' },
]

function NavGroups({ user, hotel, variant, current, onPick, navigationConfig }) {
  const placement = variant === 'drawer' ? 'side' : null
  const groups = useMemo(() => buildNav(user, hotel, navigationConfig, placement), [user, hotel, navigationConfig, placement])
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
  const [directoryState, setDirectoryState] = useState('loading')
  const [view, setView] = useState('home')
  const [createSignal, setCreateSignal] = useState(0)
  const [planningCreateRequest, setPlanningCreateRequest] = useState(null)
  const [personalizeSignal, setPersonalizeSignal] = useState(0)
  const [drawer, setDrawer] = useState(false)
  const [hotelSheet, setHotelSheet] = useState(false)
  const [insertOpen, setInsertOpen] = useState(false)
  const [urgentCreateOpen, setUrgentCreateOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notificationUnread, setNotificationUnread] = useState(0)
  const [settings, setSettings] = useState(null)
  const [cacheBusy, setCacheBusy] = useState(false)
  const [cacheStatus, setCacheStatus] = useState('')
  const [navigationConfig, setNavigationConfig] = useState({})
  const hotel = hotelById(session.hotelId)

  useEffect(() => {
    let active = true
    setUsers([])
    setUser(null)
    if (!hotel) {
      setDirectoryState('invalid-hotel')
      return () => { active = false }
    }
    setDirectoryState('loading')
    fetchDirectory(session.hotelId).then(({ users: list }) => {
      if (!active) return
      const rows = list || []
      const matchedUser = rows.find((u) => u.auth_user_id === session.userId || u.id === session.userId || u.legacy_id === session.userId) || null
      setUsers(rows)
      setUser(matchedUser)
      setDirectoryState(matchedUser ? 'ready' : 'unauthorized')
    }).catch((error) => {
      if (!active) return
      console.error('Directory struttura non disponibile', error)
      setUsers([])
      setUser(null)
      setDirectoryState('error')
    })
    return () => { active = false }
  }, [session.hotelId, session.userId, hotel])

  useEffect(() => {
    let active = true
    fetchRoleNavigation().then((config) => { if (active) setNavigationConfig(config) }).catch(() => {})
    const unsubscribe = subscribeRoleNavigation((config) => { if (active) setNavigationConfig(config) })
    return () => { active = false; unsubscribe?.() }
  }, [])

  useEffect(() => {
    const onSaleCreated = (event) => {
      if (planningCreateRequest?.kind !== 'sale') return
      if (event.detail?.hotelId && event.detail.hotelId !== hotel?.id) return
      const returnView = planningCreateRequest.returnView || 'planning-work'
      setPlanningCreateRequest(null)
      setView(returnView)
    }
    window.addEventListener('randapp-sale-booking-created', onSaleCreated)
    return () => window.removeEventListener('randapp-sale-booking-created', onSaleCreated)
  }, [planningCreateRequest, hotel?.id])

  const allowedHotels = useMemo(() => {
    const set = new Set([session.hotelId, ...(user?.hotels || [])])
    return Array.from(set).filter((id) => Boolean(hotelById(id)))
  }, [session.hotelId, user])

  const placement = useCallback((key) => placementFor(navigationConfig, user?.role, key), [navigationConfig, user?.role])

  const viewAllowed = useCallback((targetView) => {
    if (directoryState !== 'ready' || !user || !hotel) return false
    const guard = VIEW_GUARDS[targetView]
    if (guard && !guard(user, hotel)) return false
    const key = VIEW_TO_NAV_KEY[targetView]
    return !key || placement(key) !== 'off'
  }, [directoryState, user, hotel, placement])

  const safeView = useMemo(() => {
    const order = ['home', 'issues', 'housekeeping', 'interventions', 'inventory', 'planning-work', 'urgent', 'reminders', 'temperature', 'plants', 'profile', 'manual', 'feedback']
    return order.find((candidate) => viewAllowed(candidate)) || 'home'
  }, [viewAllowed])

  useEffect(() => {
    if (user && !viewAllowed(view)) {
      setPlanningCreateRequest(null)
      setView(safeView)
    }
  }, [user, view, viewAllowed, safeView])

  const pick = (item) => {
    setDrawer(false)
    const target = NAV_TARGET[item.id]
    const nextView = target?.view || item.id
    if (target?.settings) { setSettings(target.settings); return }
    if (!viewAllowed(nextView)) return
    setView(nextView)
    if (target?.create) setCreateSignal((n) => n + 1)
  }

  const openHomePersonalize = () => {
    setDrawer(false)
    if (!viewAllowed('home')) return
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

  const requestPlanningCreate = (kind) => {
    if (!viewAllowed('planning-work')) return
    if (kind === 'sale' && !viewAllowed('planning-sale')) return
    const returnView = view
    setView('planning-work')
    setPlanningCreateRequest((current) => ({ kind, nonce: (current?.nonce || 0) + 1, returnView }))
  }

  const pickInsert = (id) => {
    setInsertOpen(false)
    if (id === 'issue' && viewAllowed('issues')) {
      setView('issues')
      setCreateSignal((n) => n + 1)
      return
    }
    if (id === 'urgent' && viewAllowed('urgent')) {
      setUrgentCreateOpen(true)
      return
    }
    if (id === 'intervention' || id === 'planning-work') {
      requestPlanningCreate('work')
      return
    }
    if (id === 'planning-sale') requestPlanningCreate('sale')
  }

  const bottomNav = useMemo(() => {
    if (!user) return []
    const allowed = NAV_BUTTONS.filter((item) => {
      if (placement(item.key) !== 'bottom') return false
      if (item.id === 'menu' || item.id === 'structure') return true
      return viewAllowed(item.id)
    })
    if (allowed.length <= 5) return allowed
    const menu = allowed.find((item) => item.id === 'menu')
    return menu ? [...allowed.filter((item) => item.id !== 'menu').slice(0, 4), menu] : allowed.slice(0, 5)
  }, [user, placement, viewAllowed])

  const insertAllowed = useMemo(() => ({
    issue: Boolean(user && canUser(user, 'issues', 'create') && viewAllowed('issues')),
    urgent: Boolean(user && canSendUrgent(user) && viewAllowed('urgent')),
    intervention: Boolean(user && canCreatePlanned(user) && viewAllowed('interventions') && viewAllowed('planning-work')),
    'planning-work': Boolean(user && canCreatePlanned(user) && viewAllowed('planning-work')),
    'planning-sale': Boolean(user && viewAllowed('planning-sale')),
  }), [user, viewAllowed])

  if (directoryState === 'loading') return <Spinner label="Verifico accesso alla struttura…" />
  if (directoryState === 'invalid-hotel') return <main className="rs-content"><EmptyState icon="lock" title="Struttura non valida">La sessione indica una struttura non riconosciuta. Esci e accedi di nuovo.</EmptyState></main>
  if (directoryState === 'error') return <main className="rs-content"><EmptyState icon="warning" title="Accesso non verificabile">Non riesco a verificare i permessi della struttura. Riprova con connessione disponibile.</EmptyState></main>
  if (directoryState === 'unauthorized' || !user || !hotel) return <main className="rs-content"><EmptyState icon="lock" title="Accesso non consentito">L’utente della sessione non è abilitato per questa struttura.</EmptyState></main>
  if (settings !== null) return <Suspense fallback={<ViewFallback />}><Settings initialTab={settings} onExit={() => setSettings(null)} /></Suspense>

  const renderView = () => {
    if (!viewAllowed(view)) return <EmptyState icon="lock" title="Accesso non consentito">Questa funzione è disattivata per il ruolo {user?.role || ''}.</EmptyState>
    if (view === 'home') return <Home user={user} hotel={hotel} personalizeSignal={personalizeSignal} onNavigate={(v) => pick({ id: v })} />
    if (view === 'issues') return <Issues user={user} hotel={hotel} users={users} createSignal={createSignal} />
    if (view === 'profile') return <Profile user={user} hotel={hotel} />
    if (view === 'interventions') return <InterventionsView user={user} hotel={hotel} />
    if (view === 'inventory') return <InventoryView user={user} hotel={hotel} />
    if (view === 'my-work') return <MyWorkView user={user} hotel={hotel} />
    if (view === 'planning-work' || view === 'planning-sale') return <PlanningHub key={planningCreateRequest?.kind==='sale'?`sale-create-${planningCreateRequest.nonce}`:'planning-default'} user={user} hotel={hotel} createRequest={planningCreateRequest} allowSale={viewAllowed('planning-sale')} />
    if (view === 'urgent') return <UrgentView user={user} hotel={hotel} />
    if (view === 'reminders') return <RemindersView user={user} hotel={hotel} />
    if (view === 'temperature') return <TemperatureView hotel={hotel} />
    if (view === 'plants') return <PlantView hotel={hotel} />
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
      <div style={{ minWidth: 0 }}><b>{hotel.name}</b><small>{user ? `${user.name} · ${user.role}` : 'Manutenzione'}</small></div>
      <IconButton icon="close" label="Chiudi" onClick={() => setDrawer(false)} style={{ marginLeft: 'auto' }} />
    </div>
  )

  const showStructureSide = allowedHotels.length > 1 && placement('structure') === 'side'
  const showCacheSide = placement('cache') === 'side'
  const urgentHidden = drawer || hotelSheet || insertOpen || urgentCreateOpen || notificationsOpen

  const handleBottom = (item) => {
    if (item.id === 'menu') { setDrawer(true); return }
    if (item.id === 'structure') { setHotelSheet(true); return }
    if (viewAllowed(item.id)) setView(item.id)
  }

  return (
    <div className="rs-root">
      <div className="rs-app rs-app--with-side">
        <aside className="rs-sidebar" data-testid="sidebar">
          <div className="rs-sidebar__brand"><img src={logoFor(hotel.id)} alt={hotel.name} /><div style={{ minWidth: 0 }}><b>RandApp</b><small>{hotel.name}</small></div></div>
          {allowedHotels.length > 1 && placement('structure') !== 'off' && (
            <button className="rs-sidebar__switch" onClick={() => setHotelSheet(true)} data-testid="sidebar-switch-hotel"><Icon name="hotel" /> <span>Cambia struttura</span> <i><Icon name="chevronDown" /></i></button>
          )}
          <div className="rs-sidebar__scroll">
            <NavGroups user={user} hotel={hotel} variant="sidebar" current={view} onPick={pick} navigationConfig={navigationConfig} />
            <div className="rs-sidebar__prefs">
              {viewAllowed('home') && <><span className="rs-sidebar__label">Home</span><button className="rs-sidebar__item" onClick={openHomePersonalize} data-testid="sidebar-personalize-home"><Icon name="sliders" /> <span>Personalizza Home</span></button></>}
              <span className="rs-sidebar__label">Tema</span><ThemeControl />
              <span className="rs-sidebar__label">Dimensione interfaccia</span><UiSizeControl />
              {placement('cache') !== 'off' && <><span className="rs-sidebar__label">Sistema</span><button className="rs-sidebar__item" onClick={clearAppCache} disabled={cacheBusy} data-testid="sidebar-clear-cache"><Icon name="refresh" /> <span>{cacheStatus || 'Pulisci cache'}</span></button></>}
            </div>
          </div>
          <button className="rs-sidebar__item" onClick={onLogout} data-testid="sidebar-logout"><Icon name="logout" /> Esci</button>
        </aside>

        <header className="rs-header rs-header--operational">
          <button className="rs-hotelchip rs-hotelchip--operational" onClick={() => allowedHotels.length > 1 && placement('structure') !== 'off' ? setHotelSheet(true) : setDrawer(true)} data-testid="hotel-chip">
            <img src={logoFor(hotel.id)} alt={hotel.name} />
            <span className="rs-hotelchip__text"><b><span className="rs-hotelchip__name-mobile">{HEADER_HOTEL_LABEL[hotel.id] || hotel.name}</span><span className="rs-hotelchip__name-desktop">{hotel.name}</span></b></span>
            {allowedHotels.length > 1 && placement('structure') !== 'off' && <span className="rs-hotelchip__caret"><Icon name="chevronDown" /></span>}
          </button>
          <div className="rs-header__actions">
            <button type="button" className="rs-header__randai" onClick={() => window.dispatchEvent(new CustomEvent('randai-toggle'))} aria-label="Apri RandAI" data-testid="header-randai"><img src="/icons/randai-cat.webp" alt="" aria-hidden="true" /></button>
            <PresenceChip user={user} />
            <span className="rs-header-notify"><IconButton icon="bell" label="Notifiche" onClick={() => setNotificationsOpen(true)} data-testid="header-notifications" />{notificationUnread>0&&<span className="rs-header-notify__badge">{notificationUnread>99?'99+':notificationUnread}</span>}</span>
          </div>
        </header>

        <GlobalUrgentAlert hotel={hotel} user={user} hidden={urgentHidden || !viewAllowed('urgent')} onOpen={() => { if (viewAllowed('urgent')) setView('urgent') }} />
        <main className="rs-content" data-testid="main-content"><HousekeepingCompletionAlerts /><Suspense fallback={<ViewFallback />}>{renderView()}</Suspense></main>

        <nav className="rs-bottomnav" data-count={bottomNav.length} style={{ '--rs-bottom-count': Math.max(1, Math.min(5, bottomNav.length)) }} data-testid="bottom-nav">
          {bottomNav.map((item) => (
            <button key={item.id} className={`rs-navbtn ${view === item.id ? 'active' : ''}`} onClick={() => handleBottom(item)} data-testid={`nav-${item.id}`}>
              <Icon name={item.icon} /><small>{item.label}</small>
            </button>
          ))}
        </nav>
        {Object.values(insertAllowed).some(Boolean) && <button className="rs-navfab" onClick={() => setInsertOpen(true)} data-testid="fab-new" aria-label="Nuovo inserimento"><Icon name="plus" /></button>}
      </div>

      {insertOpen && <Suspense fallback={null}><InsertLauncher open={insertOpen} onClose={() => setInsertOpen(false)} hotel={hotel} user={user} onPick={pickInsert} allowedActions={insertAllowed} /></Suspense>}
      {urgentCreateOpen && <Suspense fallback={null}><UrgentCreateSheet open={urgentCreateOpen} onClose={() => setUrgentCreateOpen(false)} hotel={hotel} user={user} onSaved={() => { if (viewAllowed('urgent')) setView('urgent') }} /></Suspense>}

      <Sheet open={hotelSheet} onClose={() => setHotelSheet(false)} title="Cambia struttura">
        {allowedHotels.map((id) => {
          const h = hotelById(id)
          if (!h) return null
          return <button key={id} className={`rs-hotelrow ${id === hotel.id ? 'selected' : ''}`} data-testid={`switch-hotel-${id}`} onClick={() => { onSwitchHotel(id); setHotelSheet(false) }}><img src={logoFor(id)} alt={h.name} /><span><b>{h.name}</b><small>{id === hotel.id ? 'Struttura attiva' : 'Passa a questa struttura'}</small></span><i>{id === hotel.id ? <Icon name="check" /> : <Icon name="chevronRight" />}</i></button>
        })}
      </Sheet>

      <Sheet open={notificationsOpen} onClose={() => setNotificationsOpen(false)} title="Notifiche">
        <Suspense fallback={<ViewFallback />}><NotificationInbox hotel={hotel} user={user} onUnreadChange={setNotificationUnread} canOpenUrgent={viewAllowed('urgent')} canManageReminders={viewAllowed('reminders')} onOpenUrgent={() => { setNotificationsOpen(false); setView('urgent') }} onOpenReminders={() => { setNotificationsOpen(false); setView('reminders') }} /></Suspense>
      </Sheet>

      {drawer && (
        <div className="rs-overlay" onClick={() => setDrawer(false)} style={{ justifyContent: 'flex-end' }}>
          <aside className="rs-drawer" onClick={(e) => e.stopPropagation()} data-testid="drawer">
            {DrawerHeader}
            {showStructureSide && <button className="rs-drawer__switch" onClick={() => { setDrawer(false); setHotelSheet(true) }} data-testid="drawer-switch-hotel"><Icon name="hotel" /> <span>Cambia struttura</span> <i><Icon name="chevronRight" /></i></button>}
            <div className="rs-drawer__scroll">
              <NavGroups user={user} hotel={hotel} variant="drawer" current={view} onPick={pick} navigationConfig={navigationConfig} />
              <span className="rs-drawer__label">Preferenze</span>
              {viewAllowed('home') && <button className="rs-drawer__item" onClick={openHomePersonalize} data-testid="drawer-personalize-home"><Icon name="sliders" /> <span>Personalizza Home</span><i><Icon name="chevronRight" /></i></button>}
              <div className="rs-drawer__setting"><small>Tema</small><ThemeControl /></div>
              <div className="rs-drawer__setting"><small>Dimensione interfaccia</small><UiSizeControl /></div>
              {showCacheSide && <><span className="rs-drawer__label">Sistema</span><button className="rs-drawer__item" onClick={clearAppCache} disabled={cacheBusy} data-testid="drawer-clear-cache"><Icon name="refresh" /> <span>{cacheStatus || 'Pulisci cache'}</span><i><Icon name="chevronRight" /></i></button></>}
            </div>
            <button className="rs-drawer__item rs-drawer__item--danger" onClick={onLogout} data-testid="drawer-logout"><Icon name="logout" /> <span>Esci</span></button>
          </aside>
        </div>
      )}
    </div>
  )
}
