import { useState } from 'react'
import { insertUrgent } from '../urgents-data.js'
import { Button, Field, Sheet } from './ui.jsx'

export default function UrgentCreateSheet({ open, onClose, hotel, user, onSaved }) {
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    const text = note.trim()
    if (!text || saving) return
    setSaving(true)
    setError('')
    try {
      await insertUrgent({
        hotelId: hotel.id,
        note: text,
        createdBy: user?.name || 'App',
        severity: 'urgente',
      })
      setNote('')
      onSaved?.()
      onClose()
    } catch (err) {
      setError(err?.message || 'Invio allarme non riuscito')
      setSaving(false)
    }
  }

  const close = () => {
    if (saving) return
    setError('')
    onClose()
  }

  return (
    <Sheet open={open} onClose={close} className="rs-insert-shell">
      <form className="rs-form" onSubmit={submit} data-testid="new-urgent-form">
        <div className="rs-form__head">
          <div>
            <h2>Nuovo allarme</h2>
            <p>{hotel?.name} · avviso urgente immediato</p>
          </div>
        </div>

        <Field label="Messaggio urgente" error={error}>
          <textarea
            className="rs-textarea"
            rows="5"
            value={note}
            autoFocus
            placeholder="Descrivi chiaramente cosa sta succedendo…"
            onChange={(event) => setNote(event.target.value)}
            data-testid="urgent-message-input"
          />
        </Field>

        <div className="rs-form-actions">
          <Button type="button" variant="ghost" onClick={close} disabled={saving}>Annulla</Button>
          <Button type="submit" variant="primary" icon="warning" disabled={!note.trim() || saving} data-testid="submit-urgent">
            {saving ? 'Invio…' : 'Invia allarme'}
          </Button>
        </div>
      </form>
    </Sheet>
  )
}
