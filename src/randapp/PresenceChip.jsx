import { useCallback, useEffect, useMemo, useState } from 'react'
import { setOwnPresence } from '../auth-data.js'
import { loadSession } from '../session.js'
import { supabase } from '../supabase.js'
import { hotelById } from './helpers.js'

const ELIGIBLE_ROLES = new Set(['manutentore', 'Portiere Notturno', 'admin'])

async function fetchPresence() {
  if (!supabase) return null
  const { data, error } = await supabase.functions.invoke('presence-status', { body: {} })
  if (error) throw error
  if (!data?.ok) throw new Error(data?.error || 'Presenza non disponibile')
  return data
}

function compactHotelName(hotelId) {
  const name = hotelById(hotelId)?.name || hotelId || ''
  return name.replace(/^Hotel\s+/i, '').replace(/^ChocoHotel$/i, 'Choco')
}

export default function PresenceChip({ user, hotel }) {
  const activeHotel = hotel || hotelById(loadSession()?.hotelId)
  const [present, setPresent] = useState(false)
  const [presenceHotelId, setPresenceHotelId] = useState(null)
  const [eligible, setEligible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!user || !navigator.onLine) return
    try {
      const state = await fetchPresence()
      setEligible(Boolean(state?.eligible) && ELIGIBLE_ROLES.has(state?.role || user.role))
      setPresent(Boolean(state?.present))
      setPresenceHotelId(state?.hotel_id || null)
      setError('')
    } catch (err) {
      setError(err?.message || 'Presenza non disponibile')
    }
  }, [user])

  useEffect(() => {
    refresh()
    const onRefresh = () => refresh()
    window.addEventListener('focus', onRefresh)
    window.addEventListener('online', onRefresh)
    window.addEventListener('apice-presence-changed', onRefresh)
    window.addEventListener('apice-session-changed', onRefresh)
    return () => {
      window.removeEventListener('focus', onRefresh)
      window.removeEventListener('online', onRefresh)
      window.removeEventListener('apice-presence-changed', onRefresh)
      window.removeEventListener('apice-session-changed', onRefresh)
    }
  }, [refresh])

  const presentHere = Boolean(present && activeHotel?.id && presenceHotelId === activeHotel.id)
  const currentLabel = useMemo(() => compactHotelName(presenceHotelId), [presenceHotelId])

  if (!user || !activeHotel || !eligible) return null

  const toggle = async () => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const next = !presentHere
      const result = await setOwnPresence(next, next ? activeHotel.id : null)
      const actual = Boolean(result?.in_struttura ?? next)
      const actualHotelId = actual ? (result?.in_struttura_hotel_id || activeHotel.id) : null
      setPresent(actual)
      setPresenceHotelId(actualHotelId)
      window.dispatchEvent(new CustomEvent('apice-presence-changed', {
        detail: { present: actual, hotel_id: actualHotelId, role: user.role, eligible: true },
      }))
    } catch (err) {
      setError(err?.message || 'Cambio presenza non riuscito')
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const visibleLabel = present ? currentLabel : 'Fuori'
  const fullLabel = presentHere
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
      aria-pressed={presentHere}
      aria-label={`${fullLabel}. ${actionLabel}`}
      title={error || `${fullLabel} · ${actionLabel}`}
      data-testid="presence-chip"
      data-presence={present ? 'in' : 'out'}
      data-here={presentHere ? 'true' : 'false'}
    >
      <span className="rs-presence-chip__dot" aria-hidden="true" />
      <span className="rs-presence-chip__text">{busy ? '…' : visibleLabel}</span>
    </button>
  )
}
