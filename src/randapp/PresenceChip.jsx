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
      window.dispatchEvent(new CustomEvent('apice-presence-changed', { detail: { present: actual, role: user.role, eligible: true } }))
    } catch (err) {
      setError(err?.message || 'Cambio presenza non riuscito')
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={present}
      aria-label={present ? 'Sono in struttura. Premi per segnarti fuori struttura' : 'Fuori struttura. Premi per segnarti in struttura'}
      title={error || (present ? 'Premi per segnarti fuori struttura' : 'Premi per segnarti in struttura')}
      data-testid="presence-chip"
      style={{
        minHeight: 38,
        borderRadius: 999,
        border: `1px solid ${present ? 'rgba(34,197,94,.45)' : 'var(--rs-border, rgba(148,163,184,.28))'}`,
        background: present ? 'rgba(34,197,94,.12)' : 'var(--rs-surface-2, rgba(255,255,255,.04))',
        color: present ? '#4ade80' : 'var(--rs-text-2, #94a3b8)',
        padding: '0 11px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        font: 'inherit',
        fontWeight: 700,
        whiteSpace: 'nowrap',
        cursor: busy ? 'wait' : 'pointer',
        opacity: busy ? .65 : 1,
      }}
    >
      <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: 'currentColor', boxShadow: present ? '0 0 10px currentColor' : 'none' }} />
      <span>{busy ? 'Aggiorno…' : present ? 'In struttura' : 'Fuori struttura'}</span>
    </button>
  )
}
