import React, { Suspense, lazy, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import AppErrorBoundary from './error-boundary.jsx'
import { initUiSize } from './randapp/ui-size.js'
import { initTheme } from './randapp/theme.js'
import { loadSession } from './session.js'
import { registerPwa } from './pwa.js'
import './randapp/shell.css'
import './randapp/migrated.css'
import './randapp/planning-sale-v2.css'
import './randapp/insert-form.css'
import './randapp/housekeeping-alert.css'
import './housekeeping-dark-theme.css'
import './offline-status.css'
import './operation-feedback.css'
import './randapp/new-issue-form-v2.css'
import './randapp/new-issue-category-icons.css'
import './randapp/new-issue-inline-photo.css'
import './randapp/login-reference.css'
import './randapp/admin-keyboard-fix.css'
import './randapp/hotel-selector-reference.css'
import './randapp/theme-coherence.css'
import './randapp/single-insert-entry.css'
import './randapp/presence-dot.css'
import './randapp/notification-onboarding.css'
import './randapp/urgent-shell-layout-fix.css'
import './randapp/randui/foundation.css'
import './offline-status.js'
import './operation-feedback.js'
import { installDeploymentRecovery } from './deployment-recovery.js'

installDeploymentRecovery()

const App = lazy(() => import('./randapp/App.jsx'))
const RandAIAssistant = lazy(() => import('./randai/RandAIAssistant.jsx'))
const RandAIContextBridge = lazy(() => import('./randai/context/RandAIContextBridge.jsx'))
const TechnicianPortal = lazy(() => import('./technician-portal.jsx'))
const TechnicianDispatchPortal = lazy(() => import('./randapp/TechnicianDispatchPortal.jsx'))
const PublicIssueView = lazy(() => import('./public-issue-view.jsx'))
const NtfyShortLink = lazy(() => import('./randapp/ntfy/NtfyShortLink.jsx'))
const RandAIProtectedRoute = lazy(() => import('./randai/auth/RandAIProtectedRoute.jsx'))
const technicianMatch = window.location.pathname.match(/^\/tecnico\/([^/]+)\/?$/)
const technicianDispatchMatch = /^\/tecnici-esterni\/?$/.test(window.location.pathname)
const publicIssueMatch = window.location.pathname.match(/^\/s\/([^/]+)\/?$/)
const ntfyShortMatch = window.location.pathname.match(/^\/n\/([^/]+)\/?$/)
const randaiConsoleMatch = /^\/randai\/?$/.test(window.location.pathname)
const pendingNtfyShort = new URLSearchParams(window.location.search).get('ntfy_short')
const SESSION_EVENT = 'apice-session-changed'

initUiSize()
initTheme()
if (technicianMatch || publicIssueMatch) import('./styles.css')

function RouteFallback({ label = 'Caricamento…', dark = false }) {
  return <div style={{minHeight:'100dvh',display:'grid',placeItems:'center',background:dark?'#090d15':'transparent',color:dark?'#f7f9fc':'inherit',fontFamily:'system-ui'}}>{label}</div>
}

function AuthenticatedRandAI() {
  const [active, setActive] = useState(() => Boolean(loadSession()))
  useEffect(() => {
    const refresh = () => setActive(Boolean(loadSession()))
    window.addEventListener(SESSION_EVENT, refresh)
    return () => window.removeEventListener(SESSION_EVENT, refresh)
  }, [])
  if (!active) return null
  return <Suspense fallback={null}><RandAIContextBridge /><RandAIAssistant /></Suspense>
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode><AppErrorBoundary>
    {technicianMatch ? <Suspense fallback={<RouteFallback />}><TechnicianPortal token={technicianMatch[1]} /></Suspense>
      : technicianDispatchMatch ? <Suspense fallback={<RouteFallback label="Caricamento Centro Tecnici…" dark />}><TechnicianDispatchPortal /></Suspense>
      : publicIssueMatch ? <Suspense fallback={<RouteFallback />}><PublicIssueView id={publicIssueMatch[1]} /></Suspense>
      : ntfyShortMatch ? <Suspense fallback={<RouteFallback />}><NtfyShortLink alias={decodeURIComponent(ntfyShortMatch[1])} /></Suspense>
      : randaiConsoleMatch ? <Suspense fallback={<RouteFallback label="Caricamento RandAI…" dark />}><RandAIProtectedRoute /></Suspense>
      : <Suspense fallback={<RouteFallback label="Avvio RandApp…" />}><App /><AuthenticatedRandAI /></Suspense>}
  </AppErrorBoundary></React.StrictMode>,
)

if (pendingNtfyShort && !ntfyShortMatch) window.addEventListener(SESSION_EVENT,()=>window.location.replace(`/n/${encodeURIComponent(pendingNtfyShort)}`),{once:true})

function afterPageLoad(task) {
  const run = () => {
    if ('requestIdleCallback' in window) window.requestIdleCallback(() => task(), { timeout: 1500 })
    else setTimeout(task, 0)
  }
  if (document.readyState === 'complete') run()
  else window.addEventListener('load', run, { once: true })
}

if (!technicianMatch && !technicianDispatchMatch && !ntfyShortMatch && !randaiConsoleMatch) {
  // PWA registration is intentionally immediate: offline/installability is a bootstrap contract,
  // unlike authenticated operational services that can remain deferred.
  registerPwa()
  afterPageLoad(() => import('./diagnostics-client.js').then(({installDiagnosticsCapture})=>installDiagnosticsCapture()).catch(()=>{}))
  afterPageLoad(() => import('./external-telemetry.js').then(({initExternalTelemetry})=>initExternalTelemetry()).catch(()=>{}))

  let operationalModulesPromise = null
  let operationalInitialized = false
  let lastRepairUserId = null
  const loadOperationalModules = () => {
    if (!operationalModulesPromise) {
      operationalModulesPromise = Promise.all([
        import('./push.js'),
        import('./notification-onboarding.js'),
        import('./presence-status.js'),
        import('./urgent-ownership-guard.js'),
      ])
    }
    return operationalModulesPromise
  }
  const startOperationalRuntime = async () => {
    const session = loadSession()
    if (!session) return
    try {
      const [push, onboarding, presence, urgent] = await loadOperationalModules()
      if (!operationalInitialized) {
        presence.initPresenceStatusSync()
        urgent.initUrgentOwnershipGuard()
        onboarding.initNotificationOnboarding()
        operationalInitialized = true
      }
      const userId = session.authUserId || session.user?.auth_user_id || session.user?.id || null
      if (userId && userId !== lastRepairUserId) {
        lastRepairUserId = userId
        push.repairPushSubscription().catch((error)=>{if(navigator.onLine)console.warn('Ripristino notifiche non riuscito',error)})
      }
    } catch (error) {
      if (navigator.onLine) console.warn('Avvio servizi operativi rimandato', error)
    }
  }
  window.addEventListener(SESSION_EVENT, () => setTimeout(startOperationalRuntime, 250))
  if (loadSession()) afterPageLoad(startOperationalRuntime)
}
