const RECOVERY_WINDOW_MS = 2 * 60 * 1000
const RECOVERY_PREFIX = 'randapp-deployment-recovery-v2'
const RECOVERY_QUERY_KEY = '__randapp_recover'

const DEPLOYMENT_ERROR_RE = /(?:Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Unable to preload CSS|not a valid JavaScript MIME type|Expected a JavaScript-or-Wasm module script|ChunkLoadError|Loading chunk .* failed|undefined is not an object \(evaluating ['"]v\._result\.default['"]\)|Cannot read propert(?:y|ies) .*default.*(?:undefined|null)|Cannot destructure property ['"](?:TemperatureSensors|PlantStatus|Housekeeping)['"] from null or undefined value)/i

let recoveryStarted = false

export function isDeploymentAssetError(value) {
  if (!value) return false
  if (typeof value === 'string') return DEPLOYMENT_ERROR_RE.test(value)
  const message = [value?.name, value?.message, value?.stack].filter(Boolean).join(' ')
  return DEPLOYMENT_ERROR_RE.test(message)
}

function recoveryKey() {
  const sha = typeof __RANDAPP_BUILD__ !== 'undefined' ? (__RANDAPP_BUILD__?.sha || 'unknown') : 'unknown'
  return `${RECOVERY_PREFIX}:${sha}`
}

function canRecover() {
  try {
    const key = recoveryKey()
    const last = Number(window.sessionStorage.getItem(key) || 0)
    const now = Date.now()
    if (last && now - last < RECOVERY_WINDOW_MS) return false
    window.sessionStorage.setItem(key, String(now))
    return true
  } catch {
    return true
  }
}

async function clearRuntimeCaches() {
  if (!('caches' in window)) return
  try {
    const keys = await window.caches.keys()
    await Promise.all(keys.map((key) => window.caches.delete(key)))
  } catch {
    // Cache Storage e' best-effort: Safari privato puo' negarlo.
  }
}

async function refreshServiceWorkers() {
  if (!('serviceWorker' in navigator)) return
  try {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map(async (registration) => {
      try { registration.active?.postMessage?.({ type: 'PURGE_RUNTIME_CACHES' }) } catch {}
      try { registration.waiting?.postMessage?.({ type: 'PURGE_RUNTIME_CACHES' }) } catch {}
      try { registration.installing?.postMessage?.({ type: 'PURGE_RUNTIME_CACHES' }) } catch {}
      try { await registration.update() } catch {}
      try { registration.waiting?.postMessage?.({ type: 'SKIP_WAITING' }) } catch {}
    }))
    try { navigator.serviceWorker.controller?.postMessage?.({ type: 'PURGE_RUNTIME_CACHES' }) } catch {}
  } catch {
    // Il recupero deve proseguire anche se il service worker non risponde.
  }
}

function buildRecoveryUrl() {
  const url = new URL(window.location.href)
  url.searchParams.set(RECOVERY_QUERY_KEY, String(Date.now()))
  return url.href
}

function clearRecoveryMarker() {
  try {
    const url = new URL(window.location.href)
    if (!url.searchParams.has(RECOVERY_QUERY_KEY)) return
    url.searchParams.delete(RECOVERY_QUERY_KEY)
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
  } catch {}
}

export async function recoverFromDeploymentAssetError(error, event = null) {
  if (typeof window === 'undefined' || recoveryStarted || !isDeploymentAssetError(error)) return false
  if (!canRecover()) return false

  recoveryStarted = true
  event?.preventDefault?.()

  try {
    window.dispatchEvent(new CustomEvent('randapp:deployment-recovery', {
      detail: {
        message: error?.message || String(error || ''),
        build: typeof __RANDAPP_BUILD__ !== 'undefined' ? __RANDAPP_BUILD__ : null,
        at: new Date().toISOString(),
      },
    }))
  } catch {
    // La telemetria e' best-effort e non deve bloccare il recupero.
  }

  await clearRuntimeCaches()
  await refreshServiceWorkers()

  try {
    window.location.replace(buildRecoveryUrl())
  } catch {
    window.location.reload()
  }
  return true
}

export function installDeploymentRecovery() {
  if (typeof window === 'undefined' || window.__randappDeploymentRecoveryInstalled) return
  window.__randappDeploymentRecoveryInstalled = true
  clearRecoveryMarker()

  window.addEventListener('vite:preloadError', (event) => {
    const payload = event?.payload || event
    if (isDeploymentAssetError(payload)) recoverFromDeploymentAssetError(payload, event)
    else {
      // Vite riserva questo evento ai fallimenti di preload/dynamic import: Safari
      // puo' fornire un payload povero o senza message.
      recoverFromDeploymentAssetError(new Error('Failed to fetch dynamically imported module'), event)
    }
  })

  window.addEventListener('error', (event) => {
    const error = event?.error || event?.message
    if (isDeploymentAssetError(error)) recoverFromDeploymentAssetError(error, event)
  }, true)

  window.addEventListener('unhandledrejection', (event) => {
    if (isDeploymentAssetError(event?.reason)) recoverFromDeploymentAssetError(event.reason, event)
  })
}
