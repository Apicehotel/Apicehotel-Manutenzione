import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { RandAIEntry } from './randai-entry.jsx'
import './styles.css'
import './mockup-ui.css'
import './header-scale.css'
import './brand-theme.css'
import './randai-console.css'
import { registerPwa } from './pwa.js'

const path = window.location.pathname.replace(/\/+$/, '') || '/'
const RootApp = path === '/randai' ? RandAIEntry : App

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RootApp />
  </React.StrictMode>,
)

registerPwa()
