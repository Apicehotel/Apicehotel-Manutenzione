import { discardOfflineFailure, drainOfflineQueue, getOfflineFailures, getOfflineStatus, retryOfflineFailure } from './offline-store.js'

const ENTITY_LABELS = {
  issues: 'Segnalazione',
  planned: 'Intervento',
  urgents: 'Avviso urgente',
  'sale-bookings': 'Prenotazione sala',
  feedback: 'Feedback',
}

function ensureBadge() {
  let badge = document.getElementById('apice-offline-status')
  if (!badge) {
    badge = document.createElement('button')
    badge.type = 'button'
    badge.id = 'apice-offline-status'
    badge.setAttribute('aria-live', 'polite')
    badge.addEventListener('click', () => openFailurePanel())
    document.body.appendChild(badge)
  }
  return badge
}

function ensurePanel() {
  let backdrop = document.getElementById('apice-sync-panel-backdrop')
  if (backdrop) return backdrop
  backdrop = document.createElement('div')
  backdrop.id = 'apice-sync-panel-backdrop'
  backdrop.hidden = true
  backdrop.innerHTML = '<section id="apice-sync-panel" role="dialog" aria-modal="true" aria-labelledby="apice-sync-panel-title"><header><div><small>Sincronizzazione</small><h2 id="apice-sync-panel-title">Modifiche da controllare</h2></div><button type="button" class="apice-sync-close" aria-label="Chiudi">×</button></header><p class="apice-sync-explainer">RandApp non sovrascrive automaticamente dati modificati da un altro dispositivo. Scegli cosa fare per ogni modifica.</p><div class="apice-sync-failures"></div></section>'
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) backdrop.hidden = true })
  backdrop.querySelector('.apice-sync-close')?.addEventListener('click', () => { backdrop.hidden = true })
  document.body.appendChild(backdrop)
  return backdrop
}

function failureTitle(item) {
  const label = ENTITY_LABELS[item.entity] || item.entity || 'Modifica'
  const target = item.targetId || item.tempId
  return target ? `${label} · ${String(target).slice(0, 18)}` : label
}
function failureReason(item) {
  if (item.errorCode === 'OFFLINE_CONFLICT') {
    const fields = Array.isArray(item.conflictFields) && item.conflictFields.length ? ` (${item.conflictFields.join(', ')})` : ''
    return `Un altro dispositivo ha modificato gli stessi dati${fields}.`
  }
  return item.error || 'La sincronizzazione è stata bloccata dal server.'
}
async function refreshFailurePanel() {
  const backdrop = ensurePanel()
  const list = backdrop.querySelector('.apice-sync-failures')
  if (!list) return
  const failures = await getOfflineFailures().catch(() => [])
  list.replaceChildren()
  if (!failures.length) {
    const empty = document.createElement('p')
    empty.className = 'apice-sync-empty'
    empty.textContent = 'Nessuna modifica richiede attenzione.'
    list.appendChild(empty)
    return
  }
  failures.forEach((item) => {
    const card = document.createElement('article')
    card.className = 'apice-sync-failure'
    const title = document.createElement('strong')
    title.textContent = failureTitle(item)
    const reason = document.createElement('p')
    reason.textContent = failureReason(item)
    const meta = document.createElement('small')
    meta.textContent = item.hotelId ? `Struttura: ${item.hotelId}` : ''
    const actions = document.createElement('div')
    actions.className = 'apice-sync-actions'

    if (item.errorCode === 'OFFLINE_CONFLICT') {
      const server = document.createElement('button')
      server.type = 'button'; server.className = 'secondary'; server.textContent = 'Mantieni versione server'
      server.addEventListener('click', async () => { server.disabled = true; await discardOfflineFailure(item.id); await refreshFailurePanel() })
      const local = document.createElement('button')
      local.type = 'button'; local.className = 'primary'; local.textContent = 'Usa la mia modifica'
      local.addEventListener('click', async () => { local.disabled = true; await retryOfflineFailure(item.id, { force: true }); await refreshFailurePanel() })
      actions.append(server, local)
    } else {
      const discard = document.createElement('button')
      discard.type = 'button'; discard.className = 'secondary'; discard.textContent = 'Ignora modifica'
      discard.addEventListener('click', async () => { discard.disabled = true; await discardOfflineFailure(item.id); await refreshFailurePanel() })
      const retry = document.createElement('button')
      retry.type = 'button'; retry.className = 'primary'; retry.textContent = 'Riprova'
      retry.addEventListener('click', async () => { retry.disabled = true; await retryOfflineFailure(item.id); await refreshFailurePanel() })
      actions.append(discard, retry)
    }
    card.append(title, reason, meta, actions)
    list.appendChild(card)
  })
}
async function openFailurePanel() {
  const failures = await getOfflineFailures().catch(() => [])
  if (!failures.length) return
  const backdrop = ensurePanel()
  backdrop.hidden = false
  await refreshFailurePanel()
  backdrop.querySelector('.apice-sync-close')?.focus()
}

function render({ pending = 0, blocked = 0, online = navigator.onLine, syncing = false }) {
  const badge = ensureBadge()
  if (blocked > 0) {
    badge.hidden = false
    badge.disabled = false
    badge.className = 'sync-blocked'
    badge.textContent = `${blocked} ${blocked === 1 ? 'modifica richiede' : 'modifiche richiedono'} attenzione${pending ? ` · ${pending} in attesa` : ''} · Tocca per gestire`
    if (!ensurePanel().hidden) refreshFailurePanel()
    return
  }
  const panel = document.getElementById('apice-sync-panel-backdrop')
  if (panel) panel.hidden = true
  if (online && pending === 0) {
    badge.hidden = true
    badge.textContent = ''
    badge.className = ''
    return
  }
  badge.hidden = false
  badge.disabled = true
  badge.className = online ? 'syncing' : 'offline'
  badge.textContent = online
    ? `${syncing ? 'Sincronizzazione' : 'In attesa di sincronizzazione'} · ${pending} ${pending === 1 ? 'modifica' : 'modifiche'}`
    : pending
      ? `Offline · ${pending} ${pending === 1 ? 'modifica da sincronizzare' : 'modifiche da sincronizzare'}`
      : 'Offline · puoi continuare a lavorare'
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.addEventListener('apice-offline-status', (event) => render(event.detail || {}))
  window.addEventListener('online', () => drainOfflineQueue())
  getOfflineStatus().then(render).catch(() => {})
}
