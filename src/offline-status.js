import { drainOfflineQueue, getOfflineStatus } from './offline-store.js'

function ensureBadge() {
  let badge = document.getElementById('apice-offline-status')
  if (!badge) {
    badge = document.createElement('div')
    badge.id = 'apice-offline-status'
    badge.setAttribute('role', 'status')
    badge.setAttribute('aria-live', 'polite')
    document.body.appendChild(badge)
  }
  return badge
}

function render({ pending = 0, online = navigator.onLine }) {
  const badge = ensureBadge()
  if (online && pending === 0) {
    badge.hidden = true
    badge.textContent = ''
    badge.className = ''
    return
  }
  badge.hidden = false
  badge.className = online ? 'syncing' : 'offline'
  badge.textContent = online
    ? `Sincronizzazione · ${pending} ${pending === 1 ? 'modifica' : 'modifiche'} in attesa`
    : pending
      ? `Offline · ${pending} ${pending === 1 ? 'modifica da sincronizzare' : 'modifiche da sincronizzare'}`
      : 'Offline · puoi continuare a lavorare'
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.addEventListener('apice-offline-status', (event) => render(event.detail || {}))
  window.addEventListener('online', () => drainOfflineQueue())
  getOfflineStatus().then(render).catch(() => {})
}
