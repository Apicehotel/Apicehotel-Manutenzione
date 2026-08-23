import { supabase, supabaseUrl } from './supabase.js'
import { loadSession } from './session.js'

const ROOT_ID = 'apice-ntfy-profile-setup'
const ENABLE_PREFIX = 'apicehotel.ntfy.setup.v1.'
const VERIFIED_PREFIX = 'apicehotel.ntfy.verified.v1.'

const esc = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]))
const storageGet = (key) => { try { return localStorage.getItem(key) } catch { return null } }
const storageSet = (key, value) => { try { if (value == null) localStorage.removeItem(key); else localStorage.setItem(key, value) } catch {} }
const deviceKind = () => {
  const ua = navigator.userAgent || ''
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'desktop'
}

async function invoke(name, hotelId, extra = {}) {
  if (!supabase) throw new Error('Servizio notifiche non disponibile')

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw new Error('Sessione RandApp non valida')
  const token = sessionData?.session?.access_token
  if (!token) throw new Error('Sessione scaduta: esci e rientra in RandApp')

  const response = await fetch(`${supabaseUrl}/functions/v1/${encodeURIComponent(name)}`, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_Oiu7IOhuUd6YPEDmmSa7zA_ngNuiSlX',
      'Content-Type': 'application/json',
      'X-RandApp-Request': `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    },
    body: JSON.stringify({ hotel_id: hotelId, ...extra }),
  })

  let data = null
  try { data = await response.json() } catch { /* risposta non JSON */ }
  if (!response.ok) {
    const detail = data?.detail ? ` · ${data.detail}` : ''
    const code = data?.error || `HTTP ${response.status}`
    throw new Error(`${code}${detail}`)
  }
  if (!data?.ok) throw new Error(data?.error || 'Operazione non riuscita')
  return data
}

function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text)
  const input = document.createElement('textarea')
  input.value = text
  input.style.position = 'fixed'
  input.style.opacity = '0'
  document.body.appendChild(input)
  input.select()
  document.execCommand('copy')
  input.remove()
  return Promise.resolve()
}

function statusNode(root, text, kind = '') {
  const node = root.querySelector('[data-ntfy-status]')
  if (!node) return
  node.textContent = text || ''
  node.className = `ntfy-setup-status${kind ? ` ${kind}` : ''}`
}

function renderInstall(root, config, hotelId) {
  const verified = Boolean(storageGet(`${VERIFIED_PREFIX}${hotelId}`))
  const preferred = deviceKind()
  const links = [
    ['ios', 'iPhone / iPad', config.apps?.ios],
    ['android', 'Android', config.apps?.android],
    ['desktop', 'PC / Web', config.apps?.web],
  ].filter(([, , href]) => href)
    .sort(([a], [b]) => (a === preferred ? -1 : b === preferred ? 1 : 0))

  root.querySelector('[data-ntfy-body]').innerHTML = `
    <div class="ntfy-setup-progress">
      <span class="ntfy-step active">1</span><span>Installa ntfy</span>
      <span class="ntfy-step active">2</span><span>Aggiungi il topic</span>
      <span class="ntfy-step ${verified ? 'done' : ''}">3</span><span>Prova l'allarme</span>
    </div>
    <div class="ntfy-install-links">
      ${links.map(([kind, label, href]) => `<a class="ntfy-store-link ${kind === preferred ? 'recommended' : ''}" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(label)}${kind === preferred ? '<small>Questo dispositivo</small>' : ''}</a>`).join('')}
    </div>
    <div class="ntfy-topic-card">
      <small>Topic da inserire nell'app ntfy</small>
      <div><code>${esc(config.topic)}</code><button type="button" data-copy-topic>Copia</button></div>
      <p>Apri ntfy, premi <strong>+</strong> e incolla questo topic. Non condividerlo: identifica il canale di allarme della struttura.</p>
    </div>
    <div class="ntfy-setup-actions">
      <button type="button" class="primary" data-test-ntfy>${verified ? 'Ripeti test ntfy' : 'Invia test ntfy'}</button>
      <button type="button" class="secondary" data-disable-ntfy>Nascondi configurazione</button>
    </div>
    ${verified ? '<div class="ntfy-verified">✓ ntfy testato su questo dispositivo</div>' : ''}
  `

  root.querySelector('[data-copy-topic]')?.addEventListener('click', async (event) => {
    try {
      await copyText(config.topic)
      event.currentTarget.textContent = 'Copiato ✓'
      setTimeout(() => { event.currentTarget.textContent = 'Copia' }, 1600)
    } catch {
      statusNode(root, 'Non riesco a copiare automaticamente: seleziona il topic e copialo.', 'error')
    }
  })

  root.querySelector('[data-test-ntfy]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget
    const original = button.textContent
    button.disabled = true
    button.textContent = 'Invio test…'
    statusNode(root, 'Invio dell’allarme di prova in corso…')
    try {
      await invoke('ntfy-alert', hotelId, { test: true })
      storageSet(`${VERIFIED_PREFIX}${hotelId}`, new Date().toISOString())
      statusNode(root, 'Test inviato. Controlla ntfy: deve arrivare una notifica con priorità massima.', 'success')
      button.textContent = 'Test inviato ✓'
    } catch (error) {
      statusNode(root, error?.message || 'Test ntfy non riuscito.', 'error')
      button.textContent = original
    } finally {
      button.disabled = false
    }
  })

  root.querySelector('[data-disable-ntfy]')?.addEventListener('click', () => {
    storageSet(`${ENABLE_PREFIX}${hotelId}`, null)
    renderRoot(root, hotelId)
  })
}

async function loadSetup(root, hotelId) {
  statusNode(root, 'Carico configurazione ntfy…')
  try {
    const config = await invoke('ntfy-config', hotelId)
    if (!config.enabled) {
      statusNode(root, 'Il secondo canale ntfy è disattivato per questa struttura.', 'error')
      return
    }
    statusNode(root, '')
    renderInstall(root, config, hotelId)
  } catch (error) {
    statusNode(root, error?.message || 'Configurazione ntfy non disponibile.', 'error')
  }
}

function renderRoot(root, hotelId) {
  const enabled = storageGet(`${ENABLE_PREFIX}${hotelId}`) === '1'
  const verified = Boolean(storageGet(`${VERIFIED_PREFIX}${hotelId}`))
  root.innerHTML = `
    <div class="ntfy-setup-head">
      <div><strong>Allarme esterno ntfy</strong><p>Secondo canale indipendente per gli Avvisi Urgenti, oltre alle notifiche RandApp.</p></div>
      ${verified ? '<span class="ntfy-ready-badge">Testato</span>' : ''}
    </div>
    <div data-ntfy-body>
      ${enabled ? '' : `<button type="button" class="ntfy-activate" data-enable-ntfy>Attiva e configura ntfy</button><small class="ntfy-setup-hint">Ti guideremo nell’installazione e ti daremo il topic corretto della struttura.</small>`}
    </div>
    <div class="ntfy-setup-status" data-ntfy-status role="status" aria-live="polite"></div>
  `
  if (enabled) loadSetup(root, hotelId)
  else root.querySelector('[data-enable-ntfy]')?.addEventListener('click', () => {
    storageSet(`${ENABLE_PREFIX}${hotelId}`, '1')
    renderRoot(root, hotelId)
  })
}

function mount() {
  const target = document.querySelector('.profile-notif-section')
  const session = loadSession()
  if (!target || !session?.hotelId) return
  let root = target.querySelector(`#${ROOT_ID}`)
  if (!root) {
    root = document.createElement('section')
    root.id = ROOT_ID
    root.className = 'ntfy-profile-setup'
    target.appendChild(root)
  }
  if (root.dataset.hotelId !== session.hotelId) {
    root.dataset.hotelId = session.hotelId
    renderRoot(root, session.hotelId)
  } else if (!root.innerHTML.trim()) renderRoot(root, session.hotelId)
}

let scheduled = false
const scheduleMount = () => {
  if (scheduled) return
  scheduled = true
  queueMicrotask(() => { scheduled = false; mount() })
}

export function initNtfyProfileSetup() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {}
  const observer = new MutationObserver(scheduleMount)
  observer.observe(document.documentElement, { childList: true, subtree: true })
  window.addEventListener('apice-session-changed', scheduleMount)
  scheduleMount()
  return () => {
    observer.disconnect()
    window.removeEventListener('apice-session-changed', scheduleMount)
  }
}
