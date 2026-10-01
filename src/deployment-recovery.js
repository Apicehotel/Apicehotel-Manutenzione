const RECOVERY_WINDOW_MS = 2 * 60 * 1000
const RECOVERY_PREFIX = 'randapp-deployment-recovery-v2'
const RECOVERY_QUERY_KEY = '__randapp_recover'
const FRESHNESS_QUERY_KEY = '__randapp_build_refresh'
const FRESHNESS_CHECK_KEY = 'randapp-build-freshness:last-check'
const FRESHNESS_CHECK_MIN_INTERVAL_MS = 30 * 1000

const DEPLOYMENT_ERROR_RE = /(?:Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Unable to preload CSS|not a valid JavaScript MIME type|Expected a JavaScript-or-Wasm module script|ChunkLoadError|Loading chunk .* failed|undefined is not an object \(evaluating ['"]v\._result\.default['"]\)|Cannot read propert(?:y|ies) .*default.*(?:undefined|null)|Cannot destructure property ['"](?:TemperatureSensors|PlantStatus|Housekeeping)['"] from null or undefined value)/i

let recoveryStarted = false
let recoveryDeferred = false

export function isDeploymentAssetError(value) {
  if (!value) return false
  if (typeof value === 'string') return DEPLOYMENT_ERROR_RE.test(value)
  const message = [value?.name, value?.message, value?.stack].filter(Boolean).join(' ')
  return DEPLOYMENT_ERROR_RE.test(message)
}

export function canAttemptDeploymentRecovery(online = typeof navigator === 'undefined' ? true : navigator.onLine) {
  return online !== false
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

function dispatchRecoveryEvent(type, error) {
  try {
    window.dispatchEvent(new CustomEvent(type, {
      detail: {
        message: error?.message || String(error || ''),
        build: typeof __RANDAPP_BUILD__ !== 'undefined' ? __RANDAPP_BUILD__ : null,
        at: new Date().toISOString(),
      },
    }))
  } catch {
    // La telemetria e' best-effort e non deve bloccare il recupero.
  }
}

function deferRecoveryUntilOnline(error) {
  if (recoveryDeferred || typeof window === 'undefined') return
  recoveryDeferred = true
  window.addEventListener('online', () => {
    recoveryDeferred = false
    recoverFromDeploymentAssetError(error).catch(() => {})
  }, { once: true })
}

export async function recoverFromDeploymentAssetError(error, event = null) {
  if (typeof window === 'undefined' || recoveryStarted || !isDeploymentAssetError(error)) return false

  if (!canAttemptDeploymentRecovery()) {
    event?.preventDefault?.()
    dispatchRecoveryEvent('randapp:deployment-recovery-deferred', error)
    deferRecoveryUntilOnline(error)
    return false
  }

  if (!canRecover()) return false

  recoveryStarted = true
  event?.preventDefault?.()
  dispatchRecoveryEvent('randapp:deployment-recovery', error)

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
  clearFreshnessMarker()

  const scheduleFreshnessCheck = () => {
    if (document.hidden) return
    setTimeout(() => { checkForNewBuild().catch(() => {}) }, 0)
  }
  window.addEventListener('pageshow', scheduleFreshnessCheck)
  window.addEventListener('online', scheduleFreshnessCheck)
  document.addEventListener('visibilitychange', scheduleFreshnessCheck)
  scheduleFreshnessCheck()

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


function entryAssetFromHtml(html, origin) {
  if (!html) return null
  const match = String(html).match(/<script[^>]*type=["']module["'][^>]*src=["']([^"']+)["'][^>]*>/i)
    || String(html).match(/<script[^>]*src=["']([^"']+)["'][^>]*type=["']module["'][^>]*>/i)
  if (!match?.[1]) return null
  try { return new URL(match[1], origin).pathname } catch { return null }
}

export function isDocumentBuildStale(html, currentEntry, origin = 'https://example.invalid') {
  if (!html || !currentEntry) return false
  let currentPath = null
  try { currentPath = new URL(currentEntry, origin).pathname } catch { return false }
  const serverPath = entryAssetFromHtml(html, origin)
  return Boolean(serverPath && currentPath && serverPath !== currentPath)
}

function canCheckFreshnessNow() {
  try {
    const last = Number(window.sessionStorage.getItem(FRESHNESS_CHECK_KEY) || 0)
    const now = Date.now()
    if (last && now - last < FRESHNESS_CHECK_MIN_INTERVAL_MS) return false
    window.sessionStorage.setItem(FRESHNESS_CHECK_KEY, String(now))
    return true
  } catch {
    return true
  }
}

async function checkForNewBuild() {
  if (typeof window === 'undefined' || recoveryStarted || navigator.onLine === false || document.hidden) return false
  if (!canCheckFreshnessNow()) return false
  const currentEntry = document.querySelector('script[type="module"][src]')?.src
  if (!currentEntry) return false

  try {
    const url = new URL(window.location.href)
    url.hash = ''
    url.searchParams.set('__randapp_freshness', String(Date.now()))
    const response = await fetch(url.href, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } })
    if (!response.ok || !(response.headers.get('content-type') || '').includes('text/html')) return false
    const html = await response.text()
    if (!isDocumentBuildStale(html, currentEntry, window.location.origin)) return false

    recoveryStarted = true
    dispatchRecoveryEvent('randapp:build-refresh', new Error('A newer RandApp build is available'))
    await clearRuntimeCaches()
    await refreshServiceWorkers()

    const reloadUrl = new URL(window.location.href)
    reloadUrl.searchParams.set(FRESHNESS_QUERY_KEY, String(Date.now()))
    window.location.replace(reloadUrl.href)
    return true
  } catch {
    return false
  }
}

function clearFreshnessMarker() {
  try {
    const url = new URL(window.location.href)
    if (!url.searchParams.has(FRESHNESS_QUERY_KEY)) return
    url.searchParams.delete(FRESHNESS_QUERY_KEY)
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
  } catch {}
}
