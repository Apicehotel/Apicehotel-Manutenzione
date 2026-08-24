import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './randapp/App.jsx'
import TechnicianPortal from './technician-portal.jsx'
import AppErrorBoundary from './error-boundary.jsx'
import './randapp/shell.css'
import './offline-status.css'
import './operation-feedback.css'
import './offline-status.js'
import './operation-feedback.js'
import { registerPwa } from './pwa.js'
import { repairPushSubscription } from './push.js'
import { initNtfyProfileSetup } from './ntfy-profile.js'
import { initPresenceStatusSync } from './presence-status.js'
import { initUrgentOwnershipGuard } from './urgent-ownership-guard.js'

const technicianMatch = window.location.pathname.match(/^\/tecnico\/([^/]+)\/?$/)

// The standalone technician portal keeps its legacy stylesheet; load it only on that route
// so the main RandApp Dark Shell stays free of accumulated CSS.
if (technicianMatch) {
  import('./styles.css')
}

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

  const repair = (hotelId) => repairPushSubscription(hotelId).catch((error) => {
    if (navigator.onLine) console.warn('Ripristino notifiche non riuscito', error)
  })
  window.addEventListener('apice-session-changed', (event) => {
    const hotelId = event.detail?.hotelId
    if (hotelId) setTimeout(() => repair(hotelId), 250)
  })
  window.addEventListener('load', () => setTimeout(() => repair(), 1500), { once: true })
}
