import { useCallback, useEffect, useState } from 'react'
import { setOwnPresence } from '../auth-data.js'
import { supabase } from '../supabase.js'
import { Sheet } from './ui.jsx'

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
  const [open, setOpen] = useState(false)

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

  const choose = async (next) => {
    if (busy || next === present) {
      setOpen(false)
      return
    }
    setBusy(true)
    setError('')
    try {
      const result = await setOwnPresence(next)
      const actual = Boolean(result?.in_struttura ?? next)
      setPresent(actual)
      setOpen(false)
      window.dispatchEvent(new CustomEvent('apice-presence-changed', { detail: { present: actual, role: user.role, eligible: true } }))
    } catch (err) {
      setError(err?.message || 'Cambio presenza non riuscito')
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  return <>
    <button
      type="button"
      className="rs-presence-trigger"
      onClick={() => setOpen(true)}
      disabled={busy}
      aria-pressed={present}
      aria-label={present ? 'In struttura. Tocca per cambiare stato' : 'Fuori struttura. Tocca per cambiare stato'}
      title={error || 'Cambia stato presenza'}
      data-testid="presence-chip"
      data-presence={present ? 'in' : 'out'}
    >
      <span className="rs-presence-trigger__dot" aria-hidden="true" />
      <span>{busy ? 'Aggiorno…' : present ? 'In struttura' : 'Fuori struttura'}</span>
    </button>

    <Sheet open={open} onClose={() => !busy && setOpen(false)} title="Il tuo stato">
      <p style={{ margin: '-4px 0 14px', color: 'var(--rs-text-2)' }}>Scegli il tuo stato operativo.</p>
      <button type="button" className={`rs-presence-choice rs-presence-choice--in ${present ? 'selected' : ''}`} onClick={() => choose(true)} disabled={busy} data-testid="presence-in">
        <span className="rs-presence-choice__dot" aria-hidden="true" />
        <span><strong>In struttura</strong><small>Sei presente in hotel. Scade automaticamente dopo 7h20.</small></span>
        <span className="rs-presence-choice__check" aria-hidden="true">✓</span>
      </button>
      <button type="button" className={`rs-presence-choice ${!present ? 'selected' : ''}`} onClick={() => choose(false)} disabled={busy} data-testid="presence-out">
        <span className="rs-presence-choice__dot" aria-hidden="true" />
        <span><strong>Fuori struttura</strong><small>Non risulti presente operativamente in hotel.</small></span>
        <span className="rs-presence-choice__check" aria-hidden="true">✓</span>
      </button>
      {error && <p className="rs-error" role="alert" style={{ marginTop: 12 }}>{error}</p>}
    </Sheet>
  </>
}
