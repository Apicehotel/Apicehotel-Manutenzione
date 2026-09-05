import { useEffect, useMemo, useState } from 'react'
import { HOTEL_LOCATIONS } from '../../locations.js'
import { insertIssue } from '../../issues-data.js'
import { canUser } from '../../permissions.js'
import { ISSUE_CATEGORIES } from '../helpers.js'
import { linkChatMessageToIssue } from './dm-data.js'

export default function PromoteIssueDialog({ open, onClose, user, hotel, source, text, onPromoted }) {
  const catalog = HOTEL_LOCATIONS[hotel?.id]
  const choices = useMemo(() => {
    if (!catalog) return []
    const rooms = catalog.roomGroups.flatMap((group) => group.rooms).map((value) => ({ value, kind: 'Camera' }))
    const zones = catalog.zones.map((zone) => ({ value: zone.name, kind: 'Zona' }))
    return [...rooms, ...zones]
  }, [catalog])
  const [draft, setDraft] = useState({ location: '', urgency: 'media', category: 'Varie', title: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [createdIssue, setCreatedIssue] = useState(null)

  useEffect(() => {
    if (!open) return
    setDraft({ location: '', urgency: 'media', category: 'Varie', title: String(text || '').trim() })
    setBusy(false)
    setError('')
    setCreatedIssue(null)
  }, [open, text, source?.messageId])

  if (!open) return null
  const canCreate = canUser(user, 'issues', 'create')
  const selectedLocation = choices.find((item) => item.value === draft.location.trim()) || null
  const valid = Boolean(canCreate && selectedLocation && draft.title.trim())

  const linkCreatedIssue = async (issue) => {
    await linkChatMessageToIssue({
      sourceType: source.type,
      sourceId: source.id,
      sourceMessageId: source.messageId,
      issueId: issue.id,
      hotelId: hotel.id,
    })
    onPromoted?.(issue)
    onClose?.()
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!valid || busy) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError('Per promuovere una chat a segnalazione serve la connessione: il collegamento deve essere salvato insieme alla sorgente.')
      return
    }
    setBusy(true); setError('')
    try {
      const issue = await insertIssue({
        hotelId: hotel.id,
        urgency: draft.urgency,
        room: `${selectedLocation.kind} · ${selectedLocation.value}`,
        title: draft.title.trim(),
        status: 'todo',
        createdAt: Date.now(),
        createdByName: user?.name || 'RandChat',
        createdByUserId: user?.auth_user_id || user?.id || undefined,
        department: user?.department || user?.role || null,
        category: draft.category,
        origin: 'RandChat',
      })
      setCreatedIssue(issue)
      await linkCreatedIssue(issue)
    } catch (err) {
      setError(createdIssue
        ? `Segnalazione ${createdIssue.id} creata, ma il collegamento alla chat non è ancora riuscito.`
        : (err?.message || 'Promozione a segnalazione non riuscita'))
    } finally { setBusy(false) }
  }

  const retryLink = async () => {
    if (!createdIssue || busy) return
    setBusy(true); setError('')
    try { await linkCreatedIssue(createdIssue) }
    catch (err) { setError(err?.message || 'Collegamento alla chat non riuscito') }
    finally { setBusy(false) }
  }

  return <div className="rc-modal-backdrop" onClick={() => !busy && onClose?.()}>
    <section className="rc-modal rc-promote" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Promuovi a segnalazione">
      <header><div><h2>Promuovi a segnalazione</h2><small>{hotel.name} · il testo diventa dato operativo persistente</small></div><button className="rc-icon" onClick={() => !busy && onClose?.()}>×</button></header>
      {!canCreate && <div className="rc-error">Non hai il permesso di creare segnalazioni in questa struttura.</div>}
      <form className="rc-promote__form" onSubmit={submit}>
        <label>Camera o zona
          <input list="rc-promote-locations" value={draft.location} placeholder="Es. 214 oppure Hall" onChange={(event) => setDraft((current) => ({ ...current, location: event.target.value }))} />
          <datalist id="rc-promote-locations">{choices.map((item) => <option key={`${item.kind}-${item.value}`} value={item.value}>{item.kind}</option>)}</datalist>
        </label>
        {draft.location && !selectedLocation && <small className="rc-error">Scegli una camera o zona riconosciuta.</small>}
        <label>Descrizione
          <textarea rows="4" maxLength={8000} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} />
        </label>
        <label>Urgenza
          <select value={draft.urgency} onChange={(event) => setDraft((current) => ({ ...current, urgency: event.target.value }))}><option value="alta">Alta</option><option value="media">Media</option><option value="bassa">Bassa</option></select>
        </label>
        <label>Categoria
          <select value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}>{ISSUE_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}</select>
        </label>
        {error && <div className="rc-error" role="alert">{error}</div>}
        <div className="rc-promote__actions"><button type="button" onClick={() => !busy && onClose?.()}>Annulla</button>{createdIssue ? <button type="button" disabled={busy} onClick={retryLink}>{busy ? 'Collego…' : 'Riprova collegamento'}</button> : <button disabled={!valid || busy}>{busy ? 'Creo…' : 'Crea segnalazione'}</button>}</div>
      </form>
    </section>
  </div>
}
