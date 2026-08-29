import { useState } from 'react'
import { loginAdmin } from './auth-data.js'
import { RandAIConsole } from './randai-console.jsx'

export function RandAIEntry() {
  const [authorized, setAuthorized] = useState(false)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    if (!/^\d{6}$/.test(pin)) return
    setLoading(true)
    setError('')
    try {
      await loginAdmin(pin)
      setAuthorized(true)
    } catch {
      setError('PIN Admin non valido')
    } finally {
      setLoading(false)
    }
  }

  if (!authorized) {
    return <div className="randai-root randai-gate"><section className="randai-gate-card"><small>RANDAPP · AREA RISERVATA</small><h1>RandAI</h1><p>Console amministrativa avanzata. Accesso riservato agli amministratori.</p><form onSubmit={submit}><input aria-label="PIN Admin" inputMode="numeric" autoComplete="current-password" maxLength="6" pattern="[0-9]{6}" value={pin} onChange={(event) => { setPin(event.target.value.replace(/\D/g, '').slice(0, 6)); setError('') }} placeholder="PIN Admin · 6 cifre" />{error && <span className="randai-gate-error" role="alert">{error}</span>}<button disabled={pin.length !== 6 || loading}>{loading ? 'Verifico…' : 'Entra in RandAI'}</button></form></section></div>
  }

  return <div className="randai-root"><RandAIConsole user={{ name: 'RandAI Admin', role: 'Admin' }} onExit={() => { window.location.href = '/' }} /></div>
}
