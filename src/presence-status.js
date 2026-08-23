import { supabase } from './supabase.js'
import { loadSession } from './session.js'
import { setOwnPresence } from './auth-data.js'

let channel = null
let observer = null
let refreshTimer = null
let expiryTimer = null
let buttonBusy = false

const PRESENCE_MAX_MS = (7 * 60 + 20) * 60 * 1000
const rolesThatCount = new Set(['manutentore', 'admin'])
const rolesWithPresenceButton = new Set(['manutentore', 'Portiere Notturno', 'admin'])

function currentHotelId() {
  return loadSession()?.hotelId || null
}

function setUrgentPresence(names) {
  const label = document.querySelector('.urgent-presence strong')
  if (!label) return
  label.textContent = names.length
    ? `In struttura ora: ${names.join(', ')}`
    : 'Nessun manutentore risulta in struttura al momento'
}

function applyPresenceButton(state) {
  const button = document.querySelector('.ops-header .presence')
  if (!button || !state?.eligible) return
  const active = Boolean(state.present)
  button.classList.toggle('on', active)
  button.setAttribute('aria-pressed', active ? 'true' : 'false')
  button.dataset.presence = active ? 'in' : 'out'
  button.title = active ? 'Premi per segnarti fuori struttura' : 'Premi per segnarti in struttura'
}

function scheduleLocalExpiry(state) {
  clearTimeout(expiryTimer)
  if (!state?.present || !state?.expires_at) return
  const remaining = new Date(state.expires_at).getTime() - Date.now()
  if (remaining <= 0) {
    scheduleRefresh(0)
    return
  }
  expiryTimer = setTimeout(() => scheduleRefresh(0), Math.min(remaining + 250, 2147483000))
}

async function fetchCurrentPresence() {
  if (!supabase) return null
  const { data, error } = await supabase.functions.invoke('presence-status', { body: {} })
  if (error) throw error
  if (!data?.ok) throw new Error(data?.error || 'Presenza non disponibile')
  return data
}

function notExpired(person) {
  if (!person?.in_struttura) return false
  const since = person.in_struttura_dal ? new Date(person.in_struttura_dal).getTime() : 0
  return Boolean(since) && Date.now() - since < PRESENCE_MAX_MS
}

async function refreshPresence() {
  const hotelId = currentHotelId()
  if (!hotelId || !supabase || (typeof navigator !== 'undefined' && !navigator.onLine)) return
  try {
    const [{ data, error }, current] = await Promise.all([
      supabase
        .from('utenti')
        .select('nome,ruolo,in_struttura,in_struttura_dal,active,hotels')
        .contains('hotels', [hotelId])
        .eq('active', true)
        .eq('in_struttura', true),
      fetchCurrentPresence(),
    ])
    if (error) throw error
    const names = (data || [])
      .filter((person) => rolesThatCount.has(person.ruolo) && notExpired(person))
      .map((person) => person.nome)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'it'))
    setUrgentPresence(names)
    applyPresenceButton(current)
    scheduleLocalExpiry(current)
  } catch (error) {
    console.warn('Aggiornamento presenza non riuscito', error)
  }
}

function scheduleRefresh(delay = 0) {
  clearTimeout(refreshTimer)
  refreshTimer = setTimeout(refreshPresence, delay)
}

function subscribe() {
  if (!supabase) return
  if (channel) supabase.removeChannel(channel)
  channel = supabase
    .channel('apice-presence-status')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'utenti' }, () => scheduleRefresh(50))
    .subscribe()
}

async function onPresenceButtonClick(event) {
  const button = event.target?.closest?.('.ops-header .presence')
  if (!button) return

  // Questo controllo è l'unico proprietario del toggle per tutti i ruoli che
  // vedono il pulsante. Blocchiamo il vecchio handler React, che calcolava lo
  // stato solo per il ruolo manutentore e poteva inviare il valore sbagliato.
  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation?.()

  if (buttonBusy) return
  buttonBusy = true
  button.disabled = true
  button.setAttribute('aria-busy', 'true')

  try {
    const current = await fetchCurrentPresence()
    if (!current?.eligible || !rolesWithPresenceButton.has(current.role)) return

    const next = !Boolean(current.present)
    const result = await setOwnPresence(next)
    const updated = {
      ...current,
      present: Boolean(result?.in_struttura ?? next),
      since: result?.in_struttura_dal ?? (next ? new Date().toISOString() : null),
      expires_at: next
        ? new Date(new Date(result?.in_struttura_dal || Date.now()).getTime() + PRESENCE_MAX_MS).toISOString()
        : null,
    }
    applyPresenceButton(updated)
    scheduleLocalExpiry(updated)
    window.dispatchEvent(new CustomEvent('apice-presence-changed', { detail: updated }))
    scheduleRefresh(100)
  } catch (error) {
    console.warn('Toggle presenza non riuscito', error)
    scheduleRefresh(0)
  } finally {
    buttonBusy = false
    button.disabled = false
    button.removeAttribute('aria-busy')
  }
}

export function initPresenceStatusSync() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {}
  observer = new MutationObserver(() => {
    if (document.querySelector('.urgent-presence strong') || document.querySelector('.ops-header .presence')) scheduleRefresh(0)
  })
  observer.observe(document.documentElement, { childList: true, subtree: true })
  document.addEventListener('click', onPresenceButtonClick, true)
  window.addEventListener('apice-session-changed', () => {
    subscribe()
    scheduleRefresh(50)
  })
  window.addEventListener('online', () => scheduleRefresh(0))
  window.addEventListener('focus', () => scheduleRefresh(0))
  window.addEventListener('apice-presence-changed', () => scheduleRefresh(100))
  subscribe()
  scheduleRefresh(0)
  return () => {
    observer?.disconnect()
    document.removeEventListener('click', onPresenceButtonClick, true)
    if (channel && supabase) supabase.removeChannel(channel)
    clearTimeout(refreshTimer)
    clearTimeout(expiryTimer)
  }
}
