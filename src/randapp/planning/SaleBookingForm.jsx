import { useEffect, useMemo, useState } from 'react'
import { fetchBookings, insertBooking, updateBookingRow } from '../../sale-data.js'
import { upsertSaleClient, upsertSaleLayout } from '../../sale-directory-data.js'
import { Button, Sheet } from '../ui.jsx'
import SaleRoomPicker from './SaleRoomPicker.jsx'
import { SHIFTS, norm, roomAvailability, roomForBooking, roomIndex } from './sale-utils.js'
import { freshAvailabilityDecision, previousIsoDate, validateBookingDates } from './sale-booking-validation.js'

function PrepDateField({ draft, setDraft }) {
  const previousDay = previousIsoDate(draft.dateFrom)
  const sameDay = () => {
    if (!draft.dateFrom) return
    setDraft((current) => ({ ...current, prepDate: current.dateFrom }))
  }
  const choosePreviousDay = () => {
    if (!previousDay) return
    setDraft((current) => ({ ...current, prepDate: previousDay }))
  }

  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <span className="rs-field__label">Da preparare il *</span>
        <small style={{ color: 'var(--rs-text-3)' }}>giorno operativo manutenzione</small>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 6 }}>
        <button type="button" className={`rs-btn ${draft.prepDate === draft.dateFrom && draft.dateFrom ? 'rs-btn--primary' : 'rs-btn--ghost'}`} disabled={!draft.dateFrom} onClick={sameDay}>Stesso giorno</button>
        <button type="button" className={`rs-btn ${previousDay && draft.prepDate === previousDay ? 'rs-btn--primary' : 'rs-btn--ghost'}`} disabled={!previousDay} onClick={choosePreviousDay}>Giorno prima</button>
      </div>
      <input
        type="date"
        required
        max={draft.dateFrom || undefined}
        value={draft.prepDate}
        onChange={(event) => setDraft((current) => ({ ...current, prepDate: event.target.value }))}
        style={{ width: '100%', minHeight: 44, border: '1px solid var(--rs-line)', borderRadius: 12, background: 'var(--rs-surface)', color: 'var(--rs-text)', padding: '0 10px' }}
      />
    </div>
  )
}

export default function SaleBookingForm({ open, onClose, hotel, user, bookings, rooms, clients, layouts, initial, onSaved, onDirectoryChanged }) {
  const today = new Date().toLocaleDateString('sv-SE')
  const index = useMemo(() => roomIndex(rooms), [rooms])
  const empty = { client: '', dateFrom: today, dateTo: today, prepDate: today, shift: 'mattina', roomKey: '', layoutKey: '', pax: 1, notes: '', saveRecall: false, audioRequired: false, videoRequired: false }
  const [draft, setDraft] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [roomPicker, setRoomPicker] = useState(false)

  useEffect(() => {
    if (!open) return
    const configured = initial ? roomForBooking(initial, index) : null
    setDraft(initial ? {
      client: initial.client || '',
      dateFrom: initial.dateFrom || initial.date || today,
      dateTo: initial.dateTo || initial.date || today,
      prepDate: initial.prepDate || initial.dateFrom || initial.date || today,
      shift: initial.shift || 'mattina',
      roomKey: configured?.key || initial.roomKey || '',
      layoutKey: initial.layoutKey || '',
      pax: initial.pax || 1,
      notes: initial.notes || '',
      saveRecall: false,
      audioRequired: Boolean(initial.audioRequired),
      videoRequired: Boolean(initial.videoRequired),
    } : empty)
    setSaving(false)
    setRoomPicker(false)
    setError('')
  }, [open, initial?.id, hotel.id, rooms.length])

  const activeRooms = rooms.filter((room) => room.active || room.key === draft.roomKey)
  const selected = activeRooms.find((room) => room.key === draft.roomKey) || null
  const selectedLayout = layouts.find((layout) => layout.key === draft.layoutKey) || null
  const currentClient = clients.find((client) => norm(client.name) === norm(draft.client)) || null
  const applyRecall = (client) => setDraft((current) => ({
    ...current,
    client: client.name,
    roomKey: client.preferredRoomKey || '',
    layoutKey: client.preferredLayoutKey || '',
    pax: client.preferredPax || 1,
    notes: client.recurringNotes || current.notes,
  }))
  const selectedStatus = selected ? roomAvailability(selected, draft.dateFrom, draft.dateTo, draft.shift, bookings, index, initial?.id) : null
  const dateValidation = validateBookingDates(draft)
  const validDates = dateValidation.valid
  const canSave = Boolean(draft.client.trim() && selected && selectedStatus === 'free' && selectedLayout && Number(draft.pax) > 0 && validDates)

  const changeStart = (value) => setDraft((current) => {
    const nextPrep = !value
      ? ''
      : (!current.prepDate || current.prepDate > value ? value : current.prepDate)
    return {
      ...current,
      dateFrom: value,
      dateTo: current.dateTo && current.dateTo >= value ? current.dateTo : value,
      prepDate: nextPrep,
      roomKey: '',
    }
  })

  const addLayout = async () => {
    const name = window.prompt('Nome nuova configurazione')
    if (!name?.trim() || saving) return
    setSaving(true)
    setError('')
    try {
      const maxOrder = layouts.reduce((max, layout) => Math.max(max, Number(layout.sortOrder) || 0), 0)
      const created = await upsertSaleLayout({ hotelId: hotel.id, name: name.trim(), sortOrder: maxOrder + 10 })
      setDraft((current) => ({ ...current, layoutKey: created.key }))
      await onDirectoryChanged?.()
    } catch (err) {
      setError(err?.message || 'Configurazione non salvata')
    } finally {
      setSaving(false)
    }
  }

  const save = async (event) => {
    event.preventDefault()
    if (!canSave || saving) return
    setSaving(true)
    setError('')

    try {
      const fresh = await fetchBookings(hotel.id)
      const freshStatus = selected
        ? roomAvailability(selected, draft.dateFrom, draft.dateTo, draft.shift, fresh.items || [], index, initial?.id)
        : 'busy'
      const availability = freshAvailabilityDecision(fresh, freshStatus)
      if (!availability.allowed) throw new Error(availability.message)

      const payload = {
        roomKey: selected.key,
        room: selected.name,
        dateFrom: draft.dateFrom,
        dateTo: draft.dateTo,
        prepDate: draft.prepDate,
        shift: draft.shift,
        client: draft.client.trim(),
        layoutKey: selectedLayout.key,
        layout: selectedLayout.name,
        pax: Number(draft.pax),
        notes: draft.notes.trim(),
        hotelId: hotel.id,
        audioRequired: draft.audioRequired,
        videoRequired: draft.videoRequired,
        audioStatus: draft.audioRequired ? (initial?.audioStatus || 'pending') : 'not_required',
        videoStatus: draft.videoRequired ? (initial?.videoStatus || 'pending') : 'not_required',
      }

      if (initial) {
        await updateBookingRow(initial.id, payload)
      } else {
        await insertBooking({ ...payload, status: 'pending', createdBy: user?.name || 'Utente', createdAt: Date.now() })
      }

      let recallError = null
      if (draft.saveRecall) {
        try {
          await upsertSaleClient({
            hotelId: hotel.id,
            id: currentClient?.id,
            name: draft.client.trim(),
            preferredRoomKey: selected.key,
            preferredLayoutKey: selectedLayout.key,
            preferredPax: Number(draft.pax),
            recurringNotes: draft.notes.trim(),
          })
          await onDirectoryChanged?.()
        } catch (err) {
          recallError = err
        }
      }

      await onSaved?.()
      onClose?.()
      if (recallError) {
        window.alert(`Prenotazione salvata. Il richiamo cliente non è stato aggiornato: ${recallError?.message || 'errore di sincronizzazione'}`)
      }
    } catch (err) {
      setError(err?.message || 'Salvataggio non riuscito')
    } finally {
      setSaving(false)
    }
  }

  return <>
    <Sheet open={open} onClose={saving ? undefined : onClose} className="rs-sale-sheet">
      <form onSubmit={save} style={{ display: 'grid', gap: 10 }}>
        <header style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <button type="button" className="rs-btn rs-btn--ghost" disabled={saving} onClick={onClose}>‹</button>
          <div>
            <h2 style={{ margin: 0, fontFamily: 'Sora' }}>{initial ? 'Modifica prenotazione' : 'Nuova prenotazione'}</h2>
            <small style={{ color: 'var(--rs-text-3)' }}>Evento e preparazione restano due date separate.</small>
          </div>
        </header>

        <label className="rs-field">
          <span className="rs-field__label">Cliente *</span>
          <input required list="sale-clients" value={draft.client} onChange={(event) => setDraft({ ...draft, client: event.target.value })} placeholder="Nome cliente / azienda" />
          <datalist id="sale-clients">{clients.map((client) => <option key={client.id} value={client.name} />)}</datalist>
        </label>

        {currentClient?.preferredRoomKey && <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center', padding: 10, border: '1px solid color-mix(in srgb,var(--rs-ok) 35%,var(--rs-line))', borderRadius: 13, background: 'color-mix(in srgb,var(--rs-ok) 7%,var(--rs-surface))' }}>
          <div>
            <strong>Richiamo cliente</strong>
            <small style={{ display: 'block', marginTop: 2, color: 'var(--rs-text-2)' }}>{rooms.find((room) => room.key === currentClient.preferredRoomKey)?.name || 'Sala'} · {layouts.find((layout) => layout.key === currentClient.preferredLayoutKey)?.name || 'Allestimento'} · {currentClient.preferredPax || '-'} PAX</small>
          </div>
          <button type="button" className="rs-btn rs-btn--ghost" onClick={() => applyRecall(currentClient)}>Usa</button>
        </div>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
          <label className="rs-field">
            <span className="rs-field__label">Evento da *</span>
            <input required type="date" value={draft.dateFrom} onChange={(event) => changeStart(event.target.value)} />
          </label>
          <label className="rs-field">
            <span className="rs-field__label">Evento a *</span>
            <input required type="date" min={draft.dateFrom || undefined} value={draft.dateTo} onChange={(event) => setDraft({ ...draft, dateTo: event.target.value, roomKey: '' })} />
          </label>
        </div>

        <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 5 }}>
          <legend style={{ fontWeight: 800 }}>Turno evento *</legend>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 6 }}>
            {Object.entries(SHIFTS).map(([key, label]) => <button type="button" key={key} className={`rs-btn ${draft.shift === key ? 'rs-btn--primary' : 'rs-btn--ghost'}`} onClick={() => setDraft({ ...draft, shift: key, roomKey: '' })}>{label}</button>)}
          </div>
        </fieldset>

        <PrepDateField draft={draft} setDraft={setDraft} />

        <div style={{ display: 'grid', gap: 5 }}>
          <span className="rs-field__label">Sala *</span>
          <button type="button" className="rs-btn rs-btn--ghost" onClick={() => setRoomPicker(true)} style={{ minHeight: 52, justifyContent: 'space-between', textAlign: 'left' }}>
            <span>{selected ? <><strong>{selected.name}</strong><small style={{ display: 'block', color: 'var(--rs-ok)' }}>● Disponibile per l'evento</small></> : 'Scegli una sala'}</span>
            <span>›</span>
          </button>
        </div>

        <div style={{ display: 'grid', gap: 6 }}>
          <label className="rs-field">
            <span className="rs-field__label">Configurazione *</span>
            <select required value={draft.layoutKey} onChange={(event) => setDraft({ ...draft, layoutKey: event.target.value })}>
              <option value="">Scegli configurazione</option>
              {layouts.map((layout) => <option key={layout.key} value={layout.key}>{layout.name}</option>)}
            </select>
          </label>
          <button type="button" className="rs-btn rs-btn--ghost" disabled={saving} onClick={addLayout} style={{ justifySelf: 'start' }}>＋ Aggiungi configurazione</button>
        </div>

        <div style={{ display: 'grid', gap: 7, padding: 10, border: '1px solid var(--rs-line)', borderRadius: 13, background: 'var(--rs-surface-2)' }}>
          <strong>Controlli richiesti</strong>
          <label style={{ display: 'flex', alignItems: 'center', gap: 9 }}><input type="checkbox" checked={draft.audioRequired} onChange={(event) => setDraft({ ...draft, audioRequired: event.target.checked })} /><span>🔊 Audio</span></label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 9 }}><input type="checkbox" checked={draft.videoRequired} onChange={(event) => setDraft({ ...draft, videoRequired: event.target.checked })} /><span>📽 Video</span></label>
        </div>

        <div style={{ display: 'grid', gap: 5 }}>
          <span className="rs-field__label">PAX *</span>
          <div style={{ display: 'grid', gridTemplateColumns: '48px 1fr 48px', gap: 6 }}>
            <button type="button" className="rs-btn rs-btn--ghost" onClick={() => setDraft({ ...draft, pax: Math.max(1, Number(draft.pax || 1) - 1) })}>−</button>
            <input required type="number" min="1" value={draft.pax} onChange={(event) => setDraft({ ...draft, pax: event.target.value })} style={{ textAlign: 'center', border: '1px solid var(--rs-line)', borderRadius: 13, background: 'var(--rs-surface)', color: 'var(--rs-text)' }} />
            <button type="button" className="rs-btn rs-btn--ghost" onClick={() => setDraft({ ...draft, pax: Number(draft.pax || 0) + 1 })}>＋</button>
          </div>
        </div>

        <label className="rs-field"><span className="rs-field__label">Note</span><textarea className="rs-textarea" rows="3" value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="Note aggiuntive…" /></label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px' }}><input type="checkbox" checked={draft.saveRecall} onChange={(event) => setDraft({ ...draft, saveRecall: event.target.checked })} /><span>{currentClient ? 'Aggiorna richiamo cliente' : 'Salva come richiamo cliente'}</span></label>

        {!validDates && <p style={{ margin: 0, color: '#e35d6a' }}>{dateValidation.message}</p>}
        {error && <p style={{ margin: 0, color: '#e35d6a' }}>{error}</p>}
        <Button type="submit" variant="primary" size="lg" disabled={!canSave || saving}>{saving ? 'Salvataggio…' : '✓ Prenota sala'}</Button>
      </form>
    </Sheet>
    <SaleRoomPicker open={roomPicker} onClose={() => setRoomPicker(false)} rooms={activeRooms} bookings={bookings} draft={draft} index={index} selectedKey={draft.roomKey} onSelect={(key) => setDraft({ ...draft, roomKey: key })} excludeId={initial?.id} />
  </>
}
