import { useEffect, useState } from 'react'
import { createProcedureDraftFromMessage } from './procedure-draft.js'

export default function ProcedureDraftDialog({ open, groupId, hotelId, message, onClose }) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('generale')
  const [area, setArea] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState(null)

  useEffect(() => {
    if (!open) return
    setTitle(''); setCategory('generale'); setArea(''); setError(''); setCreated(null)
  }, [open, message?.id])

  if (!open || !message) return null
  const submit = async (event) => {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError('')
    try {
      const result = await createProcedureDraftFromMessage({
        groupId,
        messageId: message.id,
        hotelId,
        text: message.body,
        title,
        category,
        area: area || null,
      })
      setCreated(result)
    } catch (e) { setError(e.message || 'Creazione bozza non riuscita') }
    finally { setBusy(false) }
  }

  return <div className="rc-modal-backdrop" onClick={onClose}>
    <section className="rc-modal rc-promote" onClick={(e) => e.stopPropagation()}>
      <header><div><h2>Bozza procedura</h2><small>Il contenuto entra in RandGuide come bozza. Nessuna pubblicazione automatica.</small></div><button className="rc-icon" onClick={onClose}>×</button></header>
      {!created ? <form className="rc-promote__form" onSubmit={submit}>
        <label>Titolo opzionale<input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Se vuoto viene ricavato dal messaggio" /></label>
        <label>Categoria<input value={category} maxLength={80} onChange={(e) => setCategory(e.target.value)} /></label>
        <label>Area opzionale<input value={area} maxLength={120} onChange={(e) => setArea(e.target.value)} placeholder="Es. camere, cucina, impianti" /></label>
        <label>Testo sorgente<textarea rows={6} value={message.body || ''} readOnly /></label>
        {error && <div className="rc-error" role="alert">{error}</div>}
        <div className="rc-promote__actions"><button type="button" onClick={onClose}>Annulla</button><button disabled={busy}>{busy ? 'Creo…' : 'Crea bozza RandGuide'}</button></div>
      </form> : <div className="rc-ai-result">
        <div className="rc-procedure-card"><b>✅ Bozza creata</b><p>{created.draft.title}</p><small>ID {created.id}</small></div>
        <p>Resta in stato <b>draft</b> e richiede revisione/approvazione RandGuide prima di diventare procedura operativa.</p>
        <button onClick={onClose}>Chiudi</button>
      </div>}
    </section>
  </div>
}
