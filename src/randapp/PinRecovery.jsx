import { useMemo, useState } from 'react'
import { Button, Field, TextInput, Icon } from './ui.jsx'

function BrandMark() {
  return (
    <div className="rs-brand">
      <div className="rs-brand__logo"><img src="/logos/apicehotel-mascot.png" alt="ApiceHotel" /></div>
      <div><h1 className="rs-brand__title">RandApp</h1><p className="rs-brand__sub">Manutenzione</p></div>
    </div>
  )
}

export function PinRecoveryRequest({ user, onBack }) {
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const hotels = useMemo(() => Array.from(new Set(user?.hotels || [])).filter(Boolean), [user])

  const send = async () => {
    if (!user || !hotels.length || busy) return
    setBusy(true); setError('')
    try {
      const { requestPinRecovery } = await import('../auth-data.js')
      await requestPinRecovery({ userId: user.legacy_id || user.id, hotelId: hotels[0] })
      setSent(true)
    } catch (err) {
      setError(err?.message || 'Recupero PIN temporaneamente non disponibile')
    } finally { setBusy(false) }
  }

  return (
    <main className="rs-auth"><div className="rs-auth__inner"><BrandMark />
      <section className="rs-card rs-authcard">
        <button className="rs-textback" onClick={onBack}><Icon name="chevronLeft" /> Accesso</button>
        <header><h1>Recupera PIN</h1><p>{user?.name ? `Account: ${user.name}` : 'Account selezionato'}</p></header>
        {sent ? <>
          <p>Se per questo account è registrata un'email valida, riceverai un link per scegliere un nuovo PIN. Il link scade dopo 15 minuti.</p>
          <Button variant="primary" size="lg" className="rs-btn--block" onClick={onBack}>TORNA AL LOGIN</Button>
        </> : <>
          <p>Il link viene inviato all'email già associata al profilo. L'indirizzo non viene mostrato per proteggere i dati personali.</p>
          {error && <p className="rs-error" role="alert">{error}</p>}
          <Button variant="primary" size="lg" className="rs-btn--block" disabled={busy} onClick={send} data-testid="pin-recovery-send">
            {busy ? 'INVIO…' : 'INVIA LINK DI RECUPERO'}
          </Button>
        </>}
      </section>
    </div></main>
  )
}

export default function PinRecoveryComplete({ token, onDone }) {
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const valid = /^\d{4}$/.test(pin) && pin === confirm

  const submit = async (event) => {
    event.preventDefault(); if (!valid || busy) return
    setBusy(true); setError('')
    try {
      const { completePinRecovery } = await import('../auth-data.js')
      await completePinRecovery({ token, newPin: pin })
      setDone(true)
      try { window.history.replaceState({}, '', window.location.pathname) } catch { /* noop */ }
    } catch (err) {
      setError(err?.message || 'Link non valido o scaduto')
    } finally { setBusy(false) }
  }

  return (
    <main className="rs-auth"><div className="rs-auth__inner"><BrandMark />
      <section className="rs-card rs-authcard">
        <header><h1>Nuovo PIN</h1><p>Imposta un nuovo PIN personale di 4 cifre</p></header>
        {done ? <>
          <p>PIN aggiornato. Ora puoi accedere con il nuovo codice.</p>
          <Button variant="primary" size="lg" className="rs-btn--block" onClick={onDone}>VAI AL LOGIN</Button>
        </> : <form className="rs-authform" onSubmit={submit}>
          <Field label="Nuovo PIN"><TextInput icon="lock" value={pin} inputMode="numeric" autoComplete="new-password" placeholder="••••" onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} /></Field>
          <Field label="Ripeti PIN"><TextInput icon="lock" value={confirm} inputMode="numeric" autoComplete="new-password" placeholder="••••" onChange={(e) => setConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))} /></Field>
          {confirm && pin !== confirm && <p className="rs-error" role="alert">I PIN non coincidono</p>}
          {error && <p className="rs-error" role="alert">{error}</p>}
          <Button variant="primary" size="lg" className="rs-btn--block" disabled={!valid || busy} data-testid="pin-recovery-complete">{busy ? 'SALVO…' : 'SALVA NUOVO PIN'}</Button>
        </form>}
      </section>
    </div></main>
  )
}
