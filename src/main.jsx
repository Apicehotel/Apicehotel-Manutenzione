import React, { Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import App from './randapp/App.jsx'
import RandAIAssistant from './randai/RandAIAssistant.jsx'
import TechnicianPortal from './technician-portal.jsx'
import PublicIssueView from './public-issue-view.jsx'
import NtfyShortLink from './randapp/ntfy/NtfyShortLink.jsx'
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
import './randapp/auth-theme-fix.css'
import './randapp/theme-audit-fix.css'
import './randapp/single-insert-entry.css'
import './randapp/presence-dot.css'
import './randapp/large-header-balance.css'
import './randapp/notification-onboarding.css'
import './offline-status.js'
import './operation-feedback.js'
import { registerPwa } from './pwa.js'
import { repairPushSubscription } from './push.js'
import { initNotificationOnboarding } from './notification-onboarding.js'
import { initPresenceStatusSync } from './presence-status.js'
import { initUrgentOwnershipGuard } from './urgent-ownership-guard.js'

const RandAIControlCenter = lazy(() => import('./randai/control/RandAIControlCenter.jsx'))
const technicianMatch = window.location.pathname.match(/^\/tecnico\/([^/]+)\/?$/)
const publicIssueMatch = window.location.pathname.match(/^\/s\/([^/]+)\/?$/)
const ntfyShortMatch = window.location.pathname.match(/^\/n\/([^/]+)\/?$/)
const randaiConsoleMatch = /^\/randai\/?$/.test(window.location.pathname)
const pendingNtfyShort = new URLSearchParams(window.location.search).get('ntfy_short')

initUiSize()
initTheme()
if (technicianMatch || publicIssueMatch) import('./styles.css')

createRoot(document.getElementById('root')).render(
  <React.StrictMode><AppErrorBoundary>
    {technicianMatch ? <TechnicianPortal token={technicianMatch[1]} />
      : publicIssueMatch ? <PublicIssueView id={publicIssueMatch[1]} />
      : ntfyShortMatch ? <NtfyShortLink alias={decodeURIComponent(ntfyShortMatch[1])} />
      : randaiConsoleMatch ? <Suspense fallback={<div style={{minHeight:'100dvh',display:'grid',placeItems:'center',background:'#090d15',color:'#f7f9fc',fontFamily:'system-ui'}}>Caricamento RandAI…</div>}><RandAIControlCenter /></Suspense>
      : <><App /><RandAIAssistant /></>}
  </AppErrorBoundary></React.StrictMode>,
)

if (pendingNtfyShort && !ntfyShortMatch) window.addEventListener('apice-session-changed',()=>window.location.replace(`/n/${encodeURIComponent(pendingNtfyShort)}`),{once:true})

if (!technicianMatch && !ntfyShortMatch && !randaiConsoleMatch) {
  registerPwa(); initPresenceStatusSync(); initUrgentOwnershipGuard(); initNotificationOnboarding()
  import('./diagnostics-client.js').then(({installDiagnosticsCapture})=>installDiagnosticsCapture()).catch(()=>{})
  import('./external-telemetry.js').then(({initExternalTelemetry})=>initExternalTelemetry()).catch(()=>{})
  const repair=(hotelId)=>repairPushSubscription(hotelId).catch((error)=>{if(navigator.onLine)console.warn('Ripristino notifiche non riuscito',error)})
  window.addEventListener('apice-session-changed',(event)=>{const hotelId=event.detail?.hotelId;if(hotelId)setTimeout(()=>repair(hotelId),250)})
  window.addEventListener('load',()=>setTimeout(()=>repair(),1500),{once:true})
}
