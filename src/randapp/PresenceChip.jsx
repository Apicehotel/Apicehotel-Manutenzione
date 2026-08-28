import { useCallback, useEffect, useState } from 'react'
import { setOwnPresence } from '../auth-data.js'
import { supabase } from '../supabase.js'

const ELIGIBLE_ROLES = new Set(['manutentore', 'Portiere Notturno', 'admin'])

async function fetchPresence() {
  if (!supabase) return null
  const { data, error } = await supabase.functions.invoke('presence-status', { body: {} })
  if (error) throw error
  if (!data?.ok) throw new Error(data?.error || 'Presenza non disponibile')
  return data
}

export default function PresenceChip({ user }) {
  const [present, setPresent] = useState(false)
  const [eligible, setEligible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!user || !navigator.onLine) return
    try {
      const state = await fetchPresence()
      setEligible(Boolean(state?.eligible) && ELIGIBLE_ROLES.has(state?.role || user.role))
      setPresent(Boolean(state?.present))
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
    return () => {
      window.removeEventListener('focus', onRefresh)
      window.removeEventListener('online', onRefresh)
      window.removeEventListener('apice-presence-changed', onRefresh)
    }
  }, [refresh])

  if (!user || !eligible) return null

  const toggle = async () => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const next = !present
      const result = await setOwnPresence(next)
      const actual = Boolean(result?.in_struttura ?? next)
      setPresent(actual)
      window.dispatchEvent(new CustomEvent('apice-presence-changed', {
        detail: { present: actual, role: user.role, eligible: true },
      }))
    } catch (err) {
      setError(err?.message || 'Cambio presenza non riuscito')
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const stateLabel = present ? 'In struttura' : 'Fuori struttura'
  return (
    <button
      type="button"
      className="rs-presence-dot-button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={present}
      aria-label={`${stateLabel}. Tocca per ${present ? 'segnarti fuori struttura' : 'segnarti in struttura'}`}
      title={error || stateLabel}
      data-testid="presence-chip"
      data-presence={present ? 'in' : 'out'}
    >
      <span className="rs-presence-dot" aria-hidden="true" />
      <span className="rs-sr-only">{busy ? 'Aggiornamento presenza' : stateLabel}</span>
    </button>
  )
}
