import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'
import './mockup-ui.css'
import './header-scale.css'
import './mobile-nav-enhancer.js'
import { registerPwa } from './pwa.js'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

registerPwa()
