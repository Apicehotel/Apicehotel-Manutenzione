import { supabase } from './supabase.js'
import { loadSession } from './session.js'

let channel = null
let observer = null
let refreshTimer = null

const rolesThatCount = new Set(['manutentore', 'admin'])

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

async function refreshPresence() {
  const hotelId = currentHotelId()
  if (!hotelId || !supabase || (typeof navigator !== 'undefined' && !navigator.onLine)) return
  try {
    const { data, error } = await supabase
      .from('utenti')
      .select('nome,ruolo,in_struttura,active,hotels')
      .contains('hotels', [hotelId])
      .eq('active', true)
      .eq('in_struttura', true)
    if (error) throw error
    const names = (data || [])
      .filter((person) => rolesThatCount.has(person.ruolo))
      .map((person) => person.nome)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'it'))
    setUrgentPresence(names)
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

export function initPresenceStatusSync() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {}
  observer = new MutationObserver(() => {
    if (document.querySelector('.urgent-presence strong')) scheduleRefresh(0)
  })
  observer.observe(document.documentElement, { childList: true, subtree: true })
  window.addEventListener('apice-session-changed', () => {
    subscribe()
    scheduleRefresh(50)
  })
  window.addEventListener('online', () => scheduleRefresh(0))
  subscribe()
  scheduleRefresh(0)
  return () => {
    observer?.disconnect()
    if (channel && supabase) supabase.removeChannel(channel)
    clearTimeout(refreshTimer)
  }
}
