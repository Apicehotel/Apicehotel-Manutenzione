import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchDirectory } from '../users-data.js'
import { Icon, IconButton, Sheet, EmptyState, Spinner, UiSizeControl, ThemeControl } from './ui.jsx'
import { canCreatePlanned, canSendUrgent, logoFor, hotelById } from './helpers.js'
import { canUser } from '../permissions.js'
import { buildNav, NAV_TARGET, VIEW_GUARDS } from './nav.js'
import { fetchRoleNavigation, placementFor, subscribeRoleNavigation, VIEW_TO_NAV_KEY } from './role-navigation.js'
import { buildPrimaryBottomNav } from './shell-navigation.js'
import { resolveUserInterests } from './adaptive-layout.js'
import { initSystemInsetsBridge } from './system-insets.js'
import { contextualAddActions, contextualAddLabel } from './contextual-add.js'
import { canManageTechnicianDirectory } from './technician-directory-policy.js'
import Home from './Home.jsx'
import PresenceChip from './PresenceChip.jsx'
import CyberCatOrb from './CyberCatOrb.jsx'
import GlobalUrgentAlert from './GlobalUrgentAlert.jsx'
import HousekeepingCompletionAlerts from './HousekeepingCompletionAlerts.jsx'
import './mobile-nav-tune.css'
import './new-issue-compact.css'
import './header-mobile.css'

const Settings = lazy(() => import('./Settings.jsx'))
const Issues = lazy(() => import('./Issues.jsx'))
const ChatGroups = lazy(() => import('./chat/ChatGroups.jsx'))
const InventoryView = lazy(() => import('./InventoryView.jsx'))
const SupplyRequestsPortal = lazy(() => import('./SupplyRequestsPortal.jsx'))
const Profile = lazy(() => import('./Profile.jsx'))
const RandDesktopDownload = lazy(() => import('./RandDesktopDownload.jsx'))
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

function useDrawerSwipe({ open, setOpen }) {
  const gesture = useRef(null)
  return {
    onPointerDown: (event) => {
      if (event.pointerType === 'mouse' || (!open && event.clientX > 24)) return
      gesture.current = { x: event.clientX, y: event.clientY }
    },
    onPointerUp: (event) => {
      const start = gesture.current
      gesture.current = null
      if (!start) return
      const dx = event.clientX - start.x
      const dy = Math.abs(event.clientY - start.y)
      if (dy > 56 || Math.abs(dx) < 72) return
      if (!open && dx > 0) setOpen(true)
      if (open && dx < 0) setOpen(false)
    },
    onPointerCancel: () => { gesture.current = null },
  }
}

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
  const [technicianCreateSignal, setTechnicianCreateSignal] = useState(0)
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
  const drawerSwipe = useDrawerSwipe({ open: drawer, setOpen: setDrawer })

  useEffect(() => initSystemInsetsBridge(), [])

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
      setSettings(null)
      setView(returnView)
    }
    window.addEventListener('randapp-sale-booking-created', onSaleCreated)
    return () => window.removeEventListener('randapp-sale-booking-created', onSaleCreated)
  }, [planningCreateRequest, hotel?.id])

  useEffect(() => { setInsertOpen(false) }, [view, hotel?.id])

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
    const order = ['home', 'issues', 'chat', 'housekeeping', 'supplies', 'interventions', 'inventory', 'planning-work', 'urgent', 'reminders', 'temperature', 'plants', 'desktop-download', 'profile', 'manual', 'feedback']
    return order.find((candidate) => viewAllowed(candidate)) || 'home'
  }, [viewAllowed])

  useEffect(() => {
    if (user && !viewAllowed(view)) {
      setPlanningCreateRequest(null)
      setSettings(null)
      setView(safeView)
    }
  }, [user, view, viewAllowed, safeView])

  const pick = (item) => {
    setDrawer(false)
    const target = NAV_TARGET[item.id]
    const nextView = target?.view || item.id
    if (target?.settings) { setSettings(target.settings); return }
    if (!viewAllowed(nextView)) return
    setSettings(null)
    setView(nextView)
    if (target?.create) setCreateSignal((n) => n + 1)
  }

  const openHomePersonalize = () => {
    setDrawer(false)
    if (!viewAllowed('home')) return
    setSettings(null)
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
    setSettings(null)
    setView('planning-work')
    setPlanningCreateRequest((current) => ({ kind, nonce: (current?.nonce || 0) + 1, returnView }))
  }

  const pickInsert = (id) => {
    setInsertOpen(false)
    setSettings(null)
    if (id === 'issue' && viewAllowed('issues')) {
      setView('issues')
      setCreateSignal((n) => n + 1)
      return
    }
    if (id === 'urgent' && viewAllowed('urgent')) {
      setUrgentCreateOpen(true)
      return
    }
    if (id === 'planning-work') {
      requestPlanningCreate('work')
      return
    }
    if (id === 'planning-sale') {
      requestPlanningCreate('sale')
      return
    }
    if (id === 'technician' && viewAllowed('technicians') && canManageTechnicianDirectory(user)) {
      setView('technicians')
      setTechnicianCreateSignal((n) => n + 1)
    }
  }

  const userInterests = useMemo(() => resolveUserInterests(user), [user])
  const bottomNav = useMemo(() => {
    if (!user) return []
    return buildPrimaryBottomNav({ placement, viewAllowed, interests: userInterests })
  }, [user, placement, viewAllowed, userInterests])

  const addCapabilities = useMemo(() => ({
    issue: Boolean(user && canUser(user, 'issues', 'create') && viewAllowed('issues')),
    urgent: Boolean(user && canSendUrgent(user) && viewAllowed('urgent')),
    'planning-work': Boolean(user && canCreatePlanned(user) && viewAllowed('planning-work')),
    'planning-sale': Boolean(user && canUser(user, 'planning_sale', 'create') && viewAllowed('planning-sale')),
    technician: Boolean(user && viewAllowed('technicians') && canManageTechnicianDirectory(user)),
  }), [user, viewAllowed])

  const contextualActions = useMemo(() => contextualAddActions(view, addCapabilities), [view, addCapabilities])
  const contextualActionIds = useMemo(() => settings !== null ? [] : contextualActions.map((action) => action.id), [settings, contextualActions])
  const fabLabel = contextualAddLabel(contextualActions)
  const openContextualAdd = () => {
    if (contextualActionIds.length === 1) { pickInsert(contextualActionIds[0]); return }
    if (contextualActionIds.length > 1) setInsertOpen(true)
  }

  if (directoryState === 'loading') return <Spinner label="Verifico accesso alla struttura…" />
  if (directoryState === 'invalid-hotel') return <main className="rs-content"><EmptyState icon="lock" title="Struttura non valida">La sessione indica una struttura non riconosciuta. Esci e accedi di nuovo.</EmptyState></main>
  if (directoryState === 'error') return <main className="rs-content"><EmptyState icon="warning" title="Accesso non verificabile">Non riesco a verificare i permessi della struttura. Riprova con connessione disponibile.</EmptyState></main>
  if (directoryState === 'unauthorized' || !user || !hotel) return <main className="rs-content"><EmptyState icon="lock" title="Accesso non consentito">L’utente della sessione non è abilitato per questa struttura.</EmptyState></main>

  const renderView = () => {
    if (settings !== null) return <Settings initialTab={settings} onExit={() => setSettings(null)} embedded />
    if (!viewAllowed(view)) return <EmptyState icon="lock" title="Accesso non consentito">Questa funzione è disattivata per il ruolo {user?.role || ''}.</EmptyState>
    if (view === 'home') return <Home user={user} hotel={hotel} personalizeSignal={personalizeSignal} onNavigate={(v) => pick({ id: v })} />
    if (view === 'issues') return <Issues user={user} hotel={hotel} users={users} createSignal={createSignal} />
    if (view === 'chat') return <ChatGroups user={user} hotel={hotel} />
    if (view === 'profile') return <Profile user={user} hotel={hotel} />
    if (view === 'desktop-download') return <RandDesktopDownload />
    if (view === 'interventions') return <InterventionsView user={user} hotel={hotel} />
    if (view === 'inventory') return <InventoryView user={user} hotel={hotel} />
    if (view === 'supplies') return <SupplyRequestsPortal user={user} hotel={hotel} standalone />
    if (view === 'my-work') return <MyWorkView user={user} hotel={hotel} />
    if (view === 'planning-work' || view === 'planning-sale') return <PlanningHub key={planningCreateRequest?.kind==='sale'?`sale-create-${planningCreateRequest.nonce}`:'planning-default'} user={user} hotel={hotel} createRequest={planningCreateRequest} allowSale={viewAllowed('planning-sale')} />
    if (view === 'urgent') return <UrgentView user={user} hotel={hotel} />
    if (view === 'reminders') return <RemindersView user={user} hotel={hotel} />
    if (view === 'temperature') return <TemperatureView hotel={hotel} />
    if (view === 'plants') return <PlantView hotel={hotel} />
    if (view === 'housekeeping') return <HousekeepingView user={user} hotel={hotel} />
    if (view === 'technicians') return <TechnicianDirectoryView user={user} hotel={hotel} createSignal={technicianCreateSignal} />
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
    if (viewAllowed(item.id)) {
      setSettings(null)
      setView(item.id)
    }
  }

  return (
    <div className="rs-root" {...drawerSwipe}>
      <div className="rs-app rs-app--with-side">
        <aside className="rs-sidebar" data-testid="sidebar">
          <div className="rs-sidebar__brand"><img src={logoFor(hotel.id)} alt={hotel.name} /><div style={{ minWidth: 0 }}><b>RandApp</b><small>{hotel.name}</small></div></div>
          {allowedHotels.length > 1 && placement('structure') !== 'off' && (
            <button className="rs-sidebar__switch" onClick={() => setHotelSheet(true)} data-testid="sidebar-switch-hotel"><Icon name="hotel" /> <span>Cambia struttura</span> <i><Icon name="chevronDown" /></i></button>
          )}
          <div className="rs-sidebar__scroll">
            <NavGroups user={user} hotel={hotel} variant="sidebar" current={settings === null ? view : ''} onPick={pick} navigationConfig={navigationConfig} />
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
            <button type="button" className="rs-header__randai" onClick={() => window.dispatchEvent(new CustomEvent('randai-toggle'))} aria-label="Apri RandAI" data-testid="header-randai"><CyberCatOrb className="rs-cyber-cat-orb" /></button>
            <PresenceChip user={user} />
            <span className="rs-header-notify"><IconButton icon="bell" label="Notifiche" onClick={() => setNotificationsOpen(true)} data-testid="header-notifications" />{notificationUnread>0&&<span className="rs-header-notify__badge">{notificationUnread>99?'99+':notificationUnread}</span>}</span>
          </div>
        </header>

        <GlobalUrgentAlert hotel={hotel} user={user} hidden={urgentHidden || !viewAllowed('urgent')} onOpen={() => { if (viewAllowed('urgent')) { setSettings(null); setView('urgent') } }} />
        <main className="rs-content" data-testid="main-content"><HousekeepingCompletionAlerts /><Suspense fallback={<ViewFallback />}>{renderView()}</Suspense></main>

        <nav className="rs-bottomnav" data-count="5" data-testid="bottom-nav" aria-label="Navigazione principale">
          {bottomNav.map((item) => (
            <button key={item.id} data-slot={item.slot} className={`rs-navbtn ${settings === null && view === item.id ? 'active' : ''}`} onClick={() => handleBottom(item)} data-testid={`nav-${item.id}`} aria-current={settings === null && view === item.id ? 'page' : undefined}>
              <Icon name={item.icon} /><small>{item.label}</small>
            </button>
          ))}
        </nav>
        {contextualActionIds.length > 0 && <button className="rs-navfab" onClick={openContextualAdd} data-testid="fab-new" aria-label={fabLabel || 'Aggiungi'} title={fabLabel || 'Aggiungi'}><Icon name="plus" /></button>}
      </div>

      {insertOpen && <Suspense fallback={null}><InsertLauncher open={insertOpen} onClose={() => setInsertOpen(false)} hotel={hotel} user={user} onPick={pickInsert} actionIds={contextualActionIds} /></Suspense>}
      {urgentCreateOpen && <Suspense fallback={null}><UrgentCreateSheet open={urgentCreateOpen} onClose={() => setUrgentCreateOpen(false)} hotel={hotel} user={user} onSaved={() => { if (viewAllowed('urgent')) { setSettings(null); setView('urgent') } }} /></Suspense>}

      <Sheet open={hotelSheet} onClose={() => setHotelSheet(false)} title="Cambia struttura">
        {allowedHotels.map((id) => {
          const h = hotelById(id)
          if (!h) return null
          return <button key={id} className={`rs-hotelrow ${id === hotel.id ? 'selected' : ''}`} data-testid={`switch-hotel-${id}`} onClick={() => { onSwitchHotel(id); setHotelSheet(false) }}><img src={logoFor(id)} alt={h.name} /><span><b>{h.name}</b><small>{id === hotel.id ? 'Struttura attiva' : 'Passa a questa struttura'}</small></span><i>{id === hotel.id ? <Icon name="check" /> : <Icon name="chevronRight" />}</i></button>
        })}
      </Sheet>

      <Sheet open={notificationsOpen} onClose={() => setNotificationsOpen(false)} title="Notifiche">
        <Suspense fallback={<ViewFallback />}><NotificationInbox hotel={hotel} user={user} onUnreadChange={setNotificationUnread} canOpenUrgent={viewAllowed('urgent')} canManageReminders={viewAllowed('reminders')} onOpenUrgent={() => { setNotificationsOpen(false); setSettings(null); setView('urgent') }} onOpenReminders={() => { setNotificationsOpen(false); setSettings(null); setView('reminders') }} /></Suspense>
      </Sheet>

      {drawer && (
        <div className="rs-overlay" onClick={() => setDrawer(false)} style={{ justifyContent: 'flex-end' }}>
          <aside className="rs-drawer" onClick={(e) => e.stopPropagation()} data-testid="drawer" aria-label="Menu principale">
            {DrawerHeader}
            {showStructureSide && <button className="rs-drawer__switch" onClick={() => { setDrawer(false); setHotelSheet(true) }} data-testid="drawer-switch-hotel"><Icon name="hotel" /> <span>Cambia struttura</span> <i><Icon name="chevronRight" /></i></button>}
            <div className="rs-drawer__scroll">
              <NavGroups user={user} hotel={hotel} variant="drawer" current={settings === null ? view : ''} onPick={pick} navigationConfig={navigationConfig} />
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
