const RECOVERY_WINDOW_MS = 2 * 60 * 1000
const RECOVERY_PREFIX = 'randapp-deployment-recovery-v1'

const DEPLOYMENT_ERROR_RE = /(?:Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Unable to preload CSS|not a valid JavaScript MIME type|Expected a JavaScript-or-Wasm module script|ChunkLoadError)/i

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

async function refreshServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  try {
    const registration = await navigator.serviceWorker.getRegistration()
    if (!registration) return
    await registration.update()
    registration.waiting?.postMessage?.({ type: 'SKIP_WAITING' })
  } catch {
    // Il reload deve restare possibile anche se l'aggiornamento SW fallisce.
  }
}

export function installDeploymentRecovery() {
  if (typeof window === 'undefined' || window.__randappDeploymentRecoveryInstalled) return
  window.__randappDeploymentRecoveryInstalled = true
  let recoveryStarted = false

  const recover = async (event, error) => {
    if (recoveryStarted || !isDeploymentAssetError(error)) return false
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
      // La telemetria è best-effort e non deve bloccare il recupero.
    }

    await refreshServiceWorker()
    window.location.reload()
    return true
  }

  window.addEventListener('vite:preloadError', (event) => {
    const payload = event?.payload || event
    if (isDeploymentAssetError(payload)) recover(event, payload)
    else {
      // Vite riserva questo evento ai fallimenti di preload/dynamic import: anche
      // Safari può fornire un payload povero o senza message.
      recover(event, new Error('Failed to fetch dynamically imported module'))
    }
  })

  window.addEventListener('error', (event) => {
    const error = event?.error || event?.message
    if (isDeploymentAssetError(error)) recover(event, error)
  }, true)

  window.addEventListener('unhandledrejection', (event) => {
    if (isDeploymentAssetError(event?.reason)) recover(event, event.reason)
  })
}
