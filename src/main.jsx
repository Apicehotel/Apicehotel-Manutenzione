import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './randapp/App.jsx'
import TechnicianPortal from './technician-portal.jsx'
import PublicIssueView from './public-issue-view.jsx'
import AppErrorBoundary from './error-boundary.jsx'
import { initUiSize } from './randapp/ui-size.js'
import { initTheme } from './randapp/theme.js'
import './randapp/shell.css'
import './randapp/migrated.css'
import './randapp/planning-sale-fix.css'
import './randapp/planning-sale-v2.css'
import './randapp/insert-form.css'
import './randapp/housekeeping-alert.css'
import './housekeeping-dark-theme.css'
import './offline-status.css'
import './operation-feedback.css'
import './randapp/adaptive-layout.css'
import './randapp/new-issue-form-v2.css'
import './randapp/new-issue-category-icons.css'
import './randapp/new-issue-inline-photo.css'
import './randapp/mobile-bottom-anchor.css'
import './randapp/home-center-nav.css'
import './randapp/ui-coherence.css'
import './randapp/login-reference.css'
import './randapp/hotel-selector-reference.css'
import './offline-status.js'
import './operation-feedback.js'
import { registerPwa } from './pwa.js'
import { repairPushSubscription } from './push.js'
import { initPresenceStatusSync } from './presence-status.js'
import { initUrgentOwnershipGuard } from './urgent-ownership-guard.js'

const technicianMatch = window.location.pathname.match(/^\/tecnico\/([^/]+)\/?$/)
const publicIssueMatch = window.location.pathname.match(/^\/s\/([^/]+)\/?$/)

initUiSize()
initTheme()

if (technicianMatch || publicIssueMatch) {
  import('./styles.css')
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      {technicianMatch ? <TechnicianPortal token={technicianMatch[1]} />
        : publicIssueMatch ? <PublicIssueView id={publicIssueMatch[1]} />
        : <App />}
    </AppErrorBoundary>
  </React.StrictMode>,
)

if (!technicianMatch) {
  registerPwa()
  initPresenceStatusSync()
  initUrgentOwnershipGuard()
  import('./diagnostics-client.js').then(({ installDiagnosticsCapture }) => installDiagnosticsCapture()).catch(() => {})
  import('./external-telemetry.js').then(({ initExternalTelemetry }) => initExternalTelemetry()).catch(() => {})

  const repair = (hotelId) => repairPushSubscription(hotelId).catch((error) => {
    if (navigator.onLine) console.warn('Ripristino notifiche non riuscito', error)
  })
  window.addEventListener('apice-session-changed', (event) => {
    const hotelId = event.detail?.hotelId
    if (hotelId) setTimeout(() => repair(hotelId), 250)
  })
  window.addEventListener('load', () => setTimeout(() => repair(), 1500), { once: true })
}
