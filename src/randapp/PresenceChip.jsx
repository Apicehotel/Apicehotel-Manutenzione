import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { setOwnPresence } from '../auth-data.js'
import { loadSession } from '../session.js'
import { supabase } from '../supabase.js'
import { hotelById } from './helpers.js'

const ELIGIBLE_ROLES = new Set(['manutentore', 'Portiere Notturno', 'admin'])
const HOTEL_SHORT_LABELS = {
  hotelgio: 'GIO',
  chocohotel: 'CHO',
  brigantino: 'BRI',
}

async function fetchPresence() {
  if (!supabase) throw new Error('Presenza non disponibile')
  const { data, error } = await supabase.functions.invoke('presence-status', { body: {} })
  if (error) throw error
  if (!data?.ok) throw new Error(data?.error || 'Presenza non disponibile')
  return data
}

function compactHotelName(hotelId) {
  if (!hotelId) return ''
  return HOTEL_SHORT_LABELS[String(hotelId).toLowerCase()] || String(hotelId).toUpperCase()
}

export default function PresenceChip({ user, hotel }) {
  const activeHotel = hotel || hotelById(loadSession()?.hotelId)
  const [present, setPresent] = useState(false)
  const [presenceHotelId, setPresenceHotelId] = useState(null)
  const [eligible, setEligible] = useState(null)
  const [known, setKnown] = useState(false)
  const [expiresAt, setExpiresAt] = useState(null)
  const request = useRef(0)
  const writing = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!user?.id || writing.current) return
    const version = ++request.current
    if (!navigator.onLine) {
      setError('Sei offline. Riconnettiti per aggiornare la presenza.')
      return
    }
    try {
      const state = await fetchPresence()
      if (version !== request.current) return
      setEligible(Boolean(state?.eligible) && ELIGIBLE_ROLES.has(state?.role || user.role))
      setPresent(Boolean(state?.present))
      setPresenceHotelId(state?.hotel_id || null)
      setExpiresAt(state?.expires_at || null)
      setKnown(true)
      setError('')
    } catch (err) {
      if (version === request.current) setError(err?.message || 'Presenza non disponibile')
    }
  }, [user?.id, user?.role])

  useEffect(() => {
    writing.current = false
    setBusy(false)
    setEligible(null)
    setKnown(false)
    setPresent(false)
    setPresenceHotelId(null)
    setExpiresAt(null)
    setError('')
    refresh()
    const onRefresh = () => refresh()
    const events = ['focus', 'online', 'offline', 'apice-presence-changed', 'apice-session-changed']
    events.forEach(name => window.addEventListener(name, onRefresh))
    return () => {
      ++request.current
      events.forEach(name => window.removeEventListener(name, onRefresh))
    }
  }, [refresh])

  useEffect(() => {
    if (!expiresAt) return
    const remaining = new Date(expiresAt).getTime() - Date.now()
    if (!Number.isFinite(remaining)) return
    const timer = setTimeout(() => { setKnown(false); refresh() }, Math.max(0, Math.min(remaining + 250, 2147483000)))
    return () => clearTimeout(timer)
  }, [expiresAt, refresh])

  const presentHere = Boolean(present && activeHotel?.id && presenceHotelId === activeHotel.id)
  const currentLabel = useMemo(() => compactHotelName(presenceHotelId), [presenceHotelId])

  if (!user || !activeHotel || !(eligible ?? ELIGIBLE_ROLES.has(user.role))) return null

  const toggle = async () => {
    if (writing.current) return
    writing.current = true
    const version = ++request.current
    setBusy(true)
    setError('')
    try {
      const next = !known || !presentHere
      const result = await setOwnPresence(next, next ? activeHotel.id : null)
      if (version !== request.current) return
      const actual = Boolean(result?.in_struttura ?? next)
      const actualHotelId = actual ? (result?.in_struttura_hotel_id || activeHotel.id) : null
      setKnown(true)
      setExpiresAt(actual ? new Date(new Date(result?.in_struttura_dal || Date.now()).getTime() + (7 * 60 + 20) * 60 * 1000).toISOString() : null)
      setPresent(actual)
      setPresenceHotelId(actualHotelId)
      window.dispatchEvent(new CustomEvent('apice-presence-changed', {
        detail: { present: actual, hotel_id: actualHotelId, role: user.role, eligible: true },
      }))
    } catch (err) {
      if (version === request.current) setError(err?.message || 'Cambio presenza non riuscito')
    } finally {
      if (version === request.current) {
        writing.current = false
        setBusy(false)
      }
    }
  }

  const visibleLabel = known && presentHere ? 'Sono fuori struttura' : 'Sono in struttura'
  const fullLabel = !known ? 'Presenza da verificare' : presentHere
    ? `In struttura · ${activeHotel.name}`
    : present
      ? `In struttura · ${hotelById(presenceHotelId)?.name || currentLabel}`
      : 'Fuori struttura'
  const actionLabel = presentHere
    ? 'Tocca per segnarti fuori struttura'
    : present
      ? `Tocca per spostare la presenza a ${activeHotel.name}`
      : `Tocca per segnarti in ${activeHotel.name}`

  return (
    <button
      type="button"
      className="rs-presence-chip"
      onClick={toggle}
      disabled={busy}
      aria-pressed={known ? presentHere : false}
      aria-busy={busy}
      aria-label={`${visibleLabel}. ${fullLabel}. ${actionLabel}`}
      title={error || `${fullLabel} · ${actionLabel}`}
      data-testid="presence-chip"
      data-presence={known ? (present ? 'in' : 'out') : 'unknown'}
      data-here={presentHere ? 'true' : 'false'}
    >
      <span className="rs-presence-chip__liquid" aria-hidden="true">
        <span className="rs-presence-chip__wave" />
        <span className="rs-presence-chip__dot" />
      </span>
      <span className="rs-presence-chip__copy">
        <span className="rs-presence-chip__text">{busy ? 'Salvataggio…' : visibleLabel}</span>
        <small role="status">{error || (!known ? 'Stato non verificato' : presentHere ? `Presente · ${currentLabel}` : present ? `Presente in ${currentLabel}` : 'Fuori struttura')}</small>
      </span>
    </button>
  )
}
