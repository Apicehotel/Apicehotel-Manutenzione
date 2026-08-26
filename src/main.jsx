import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './randapp/App.jsx'
import HousekeepingCompletionAlerts from './randapp/HousekeepingCompletionAlerts.jsx'
import TechnicianPortal from './technician-portal.jsx'
import AppErrorBoundary from './error-boundary.jsx'
import { initUiSize } from './randapp/ui-size.js'
import { initTheme } from './randapp/theme.js'
import './randapp/shell.css'
import './randapp/migrated.css'
import './randapp/insert-form.css'
import './randapp/housekeeping-alert.css'
import './housekeeping-dark-theme.css'
import './offline-status.css'
import './operation-feedback.css'
import './randapp/adaptive-layout.css'
import './offline-status.js'
import './operation-feedback.js'
import { registerPwa } from './pwa.js'
import { repairPushSubscription } from './push.js'
import { initPresenceStatusSync } from './presence-status.js'
import { initUrgentOwnershipGuard } from './urgent-ownership-guard.js'

const technicianMatch = window.location.pathname.match(/^\/tecnico\/([^/]+)\/?$/)

initUiSize()
initTheme()

if (technicianMatch) {
  import('./styles.css')
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      {technicianMatch ? <TechnicianPortal token={technicianMatch[1]} /> : <><App /><HousekeepingCompletionAlerts /></>}
    </AppErrorBoundary>
  </React.StrictMode>,
)

if (!technicianMatch) {
  registerPwa()
  initPresenceStatusSync()
  initUrgentOwnershipGuard()

  const repair = (hotelId) => repairPushSubscription(hotelId).catch((error) => {
    if (navigator.onLine) console.warn('Ripristino notifiche non riuscito', error)
  })
  window.addEventListener('apice-session-changed', (event) => {
    const hotelId = event.detail?.hotelId
    if (hotelId) setTimeout(() => repair(hotelId), 250)
  })
  window.addEventListener('load', () => setTimeout(() => repair(), 1500), { once: true })
}
