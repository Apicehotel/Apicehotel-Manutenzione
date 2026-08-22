import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import TechnicianPortal from './technician-portal.jsx'
import AppErrorBoundary from './error-boundary.jsx'
import './styles.css'
import './mockup-ui.css'
import './header-scale.css'
import './brand-theme.css'
import './admin-mobile-footer.css'
import './issue-detail-layout.css'
import './offline-status.css'
import './home-fab-fix.css'
import './operation-feedback.css'
import './offline-status.js'
import './operation-feedback.js'
import { registerPwa } from './pwa.js'

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

if (!technicianMatch) registerPwa()
