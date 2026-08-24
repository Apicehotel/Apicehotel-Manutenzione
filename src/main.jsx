import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import TechnicianPortal from './technician-portal.jsx'
import AppErrorBoundary from './error-boundary.jsx'
import './styles.css'
import './mockup-ui.css'
import './header-scale.css'
import './brand-theme.css'
import './issue-detail-layout.css'
import './offline-status.css'
import './home-fab-fix.css'
import './operation-feedback.css'
import './issue-filters.css'
import './ntfy-profile.css'
import './urgent-actions-fix.css'
import './urgent-send-fab.css'
import './desktop-layout.css'
import './hotel-selector-desktop.css'
import './hotel-selector-mobile-lock.css'
import './randapp-design-system.css'
import './randapp-desktop-v2.css'
import './randapp-layout-overhaul.css'
import './randapp-ambient-theme.css'
import './randapp-edge-fit.css'
import './admin-entry-visibility.css'
import './admin-dashboard-v2.css'
import './admin-section-nav.css'
import './role-navigation-config.css'
import './admin-mobile-v2.css'
import './drawer-menu-v2.css'
import './planned-assignees-groups.css'
import './planning-sale-mobile-fix.css'
// Unified UI v1 remains as compatibility layer; v2 is the final visual authority.
import './unified-ui-v1.css'
import './unified-ui-v2.css'
import './offline-status.js'
import './operation-feedback.js'
import { registerPwa } from './pwa.js'
import { repairPushSubscription } from './push.js'
import { initNtfyProfileSetup } from './ntfy-profile.js'
import { initPresenceStatusSync } from './presence-status.js'
import { initUrgentOwnershipGuard } from './urgent-ownership-guard.js'
import { initAdminSectionNavigation } from './admin-section-nav.js'
import { initDrawerMenuV2 } from './drawer-menu-v2.js'
import { initPlannedAssigneeGroups } from './planned-assignees-groups.js'
import { initUnifiedUiV1 } from './unified-ui-v1.js'

// Link personale del tecnico esterno (/tecnico/<token>): pagina pubblica
// leggera, separata dal flusso PIN/Home dell'app principale.
const technicianMatch = window.location.pathname.match(/^\/tecnico\/([^/]+)\/?$/)

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      {technicianMatch ? <TechnicianPortal token={technicianMatch[1]} /> : <App />}
    </AppErrorBoundary>
  </React.StrictMode>,
)

if (!technicianMatch) {
  registerPwa()
  initNtfyProfileSetup()
  initPresenceStatusSync()
  initUrgentOwnershipGuard()
  initAdminSectionNavigation()
  initDrawerMenuV2()
  initPlannedAssigneeGroups()
  initUnifiedUiV1()

  // Una subscription Web Push appartiene al browser/dispositivo, ma RandApp
  // può essere usata su più hotel. Quando il login cambia struttura,
  // riallineiamo automaticamente la stessa subscription con il nuovo hotel.
  // Così iOS PWA, Android e PC non dipendono dal riaprire manualmente il
  // pannello Notifiche dopo un cambio struttura o un aggiornamento cache.
  const repair = (hotelId) => repairPushSubscription(hotelId).catch((error) => {
    if (navigator.onLine) console.warn('Ripristino notifiche non riuscito', error)
  })
  window.addEventListener('apice-session-changed', (event) => {
    const hotelId = event.detail?.hotelId
    if (hotelId) setTimeout(() => repair(hotelId), 250)
  })
  window.addEventListener('load', () => setTimeout(() => repair(), 1500), { once: true })
}
