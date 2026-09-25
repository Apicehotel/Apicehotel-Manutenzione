import { useCallback, useRef, useState } from 'react'

export function operationalErrorMessage(error) {
  const message = String(error?.message || '').trim()
  return message || 'Operazione non riuscita. Il dettaglio resta aperto: riprova.'
}

export function createOperationalActionGate() {
  let active = false
  return {
    get busy() { return active },
    async run(action) {
      if (typeof action !== 'function') return { ok: false, ignored: true, reason: 'NO_ACTION' }
      if (active) return { ok: false, ignored: true, reason: 'BUSY' }
      active = true
      try {
        return { ok: true, value: await action() }
      } catch (error) {
        return { ok: false, error }
      } finally {
        active = false
      }
    },
  }
}

export function useOperationalActionGuard() {
  const gateRef = useRef(null)
  if (!gateRef.current) gateRef.current = createOperationalActionGate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const run = useCallback((action, { onStart, onSuccess, onSettled } = {}) => {
    if (gateRef.current.busy) return Promise.resolve({ ok: false, ignored: true, reason: 'BUSY' })
    setBusy(true)
    setError('')
    onStart?.()

    return gateRef.current.run(async () => {
      const value = await action()
      await onSuccess?.(value)
      return value
    }).then((result) => {
      if (!result.ok && !result.ignored) setError(operationalErrorMessage(result.error))
      return result
    }).finally(() => {
      setBusy(false)
      onSettled?.()
    })
  }, [])

  return { busy, error, run, clearError: () => setError('') }
}
