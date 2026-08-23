import { supabase } from './supabase.js'
import { loadSession } from './session.js'
import { setOwnPresence } from './auth-data.js'

let channel = null
let observer = null
let refreshTimer = null
let buttonBusy = false

const rolesThatCount = new Set(['manutentore', 'admin'])
const rolesWithPresenceButton = new Set(['manutentore', 'Portiere Notturno', 'admin'])

function currentSession() {
  return loadSession()
}

function currentHotelId() {
  return currentSession()?.hotelId || null
}

function setUrgentPresence(names) {
  const label = document.querySelector('.urgent-presence strong')
  if (!label) return
  label.textContent = names.length
    ? `In struttura ora: ${names.join(', ')}`
    : 'Nessun manutentore risulta in struttura al momento'
}

function applyPresenceButton(row) {
  const button = document.querySelector('.ops-header .presence')
  if (!button || !row || !rolesWithPresenceButton.has(row.ruolo)) return
  const active = Boolean(row.in_struttura)
  button.classList.toggle('on', active)
  button.setAttribute('aria-pressed', active ? 'true' : 'false')
  button.title = active ? 'Premi per segnarti fuori struttura' : 'Premi per segnarti in struttura'
}

async function fetchCurrentPresence() {
  const session = currentSession()
  if (!session?.userId || !supabase) return null
  const { data, error } = await supabase
    .from('utenti')
    .select('id,ruolo,in_struttura,in_struttura_dal')
    .eq('id', session.userId)
    .maybeSingle()
  if (error) throw error
  return data || null
}

async function refreshPresence() {
  const hotelId = currentHotelId()
  if (!hotelId || !supabase || (typeof navigator !== 'undefined' && !navigator.onLine)) return
  try {
    const [{ data, error }, current] = await Promise.all([
      supabase
        .from('utenti')
        .select('nome,ruolo,in_struttura,active,hotels')
        .contains('hotels', [hotelId])
        .eq('active', true)
        .eq('in_struttura', true),
      fetchCurrentPresence(),
    ])
    if (error) throw error
    const names = (data || [])
      .filter((person) => rolesThatCount.has(person.ruolo))
      .map((person) => person.nome)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'it'))
    setUrgentPresence(names)
    applyPresenceButton(current)
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
  if (!button || buttonBusy) return

  try {
    const current = await fetchCurrentPresence()
    if (!current || !rolesWithPresenceButton.has(current.ruolo)) return

    // In App.jsx lo stato `presence` è ancora calcolato solo per il ruolo
    // manutentore. Per admin e Portiere Notturno questo faceva sì che il
    // pulsante inviasse sempre `true` e non potesse mai spegnersi.
    // Intercettiamo quindi solo questi due ruoli e usiamo il valore reale DB.
    if (current.ruolo === 'manutentore') return

    event.preventDefault()
    event.stopPropagation()
    buttonBusy = true
    button.disabled = true
    const next = !Boolean(current.in_struttura)
    await setOwnPresence(next)
    applyPresenceButton({ ...current, in_struttura: next })
    scheduleRefresh(0)
  } catch (error) {
    console.warn('Toggle presenza non riuscito', error)
    scheduleRefresh(0)
  } finally {
    buttonBusy = false
    if (button) button.disabled = false
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
  subscribe()
  scheduleRefresh(0)
  return () => {
    observer?.disconnect()
    document.removeEventListener('click', onPresenceButtonClick, true)
    if (channel && supabase) supabase.removeChannel(channel)
    clearTimeout(refreshTimer)
  }
}
