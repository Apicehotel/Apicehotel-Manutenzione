import { supabase } from './supabase.js'
import { setOwnPresence } from './auth-data.js'

const SESSION_KEY = 'apicehotel.session.v1'
const ELIGIBLE_ROLES = new Set(['manutentore', 'Portiere Notturno', 'admin'])

function readSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') } catch { return null }
}

async function readPresence() {
  const session = readSession()
  if (!supabase || !session?.userId) return null
  const { data, error } = await supabase
    .from('utenti')
    .select('id,ruolo,in_struttura,in_struttura_dal')
    .eq('id', session.userId)
    .maybeSingle()
  if (error || !data || !ELIGIBLE_ROLES.has(data.ruolo)) return null
  return data
}

function applyState(button, row) {
  if (!button || !row) return
  const active = Boolean(row.in_struttura)
  button.classList.toggle('on', active)
  button.setAttribute('aria-pressed', active ? 'true' : 'false')
  button.title = active ? 'Premi per segnarti fuori struttura' : 'Premi per segnarti in struttura'
}

export function initPresenceControlFix() {
  let busy = false

  const refresh = async () => {
    const button = document.querySelector('.ops-header .presence')
    if (!button) return
    const row = await readPresence().catch(() => null)
    if (row) applyState(button, row)
  }

  document.addEventListener('click', async (event) => {
    const button = event.target?.closest?.('.ops-header .presence')
    if (!button || busy) return

    const row = await readPresence().catch(() => null)
    if (!row) return

    // App.jsx calcola ancora `presence` solo per il ruolo manutentore.
    // Per admin e Portiere Notturno intercettiamo il click prima che React
    // possa inviare sempre `true`, rendendo il controllo un vero toggle.
    if (row.ruolo === 'manutentore') return

    event.preventDefault()
    event.stopPropagation()
    busy = true
    button.disabled = true
    try {
      const next = !Boolean(row.in_struttura)
      await setOwnPresence(next)
      applyState(button, { ...row, in_struttura: next })
      window.dispatchEvent(new CustomEvent('apice-presence-changed', { detail: { present: next } }))
    } catch (error) {
      console.error('Aggiornamento presenza non riuscito', error)
      applyState(button, row)
    } finally {
      busy = false
      button.disabled = false
    }
  }, true)

  const observer = new MutationObserver(() => { refresh() })
  observer.observe(document.documentElement, { childList: true, subtree: true })
  window.addEventListener('apice-session-changed', () => setTimeout(refresh, 100))
  window.addEventListener('focus', refresh)
  setTimeout(refresh, 300)
}
