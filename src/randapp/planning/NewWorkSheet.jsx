import { useEffect, useMemo, useState } from 'react'
import { createPlanningWork } from '../../planning-work-data.js'
import { Button, Sheet } from '../ui.jsx'
import { WEEKDAYS, addDays, iso } from './date-utils.js'

const label = (date) => `${WEEKDAYS[date.getDay()]} ${date.getDate()}/${date.getMonth() + 1}`
const rangeLabel = (start) => `${start.getDate()}/${start.getMonth() + 1} – ${addDays(start, 6).getDate()}/${addDays(start, 6).getMonth() + 1}`

export default function NewWorkSheet({ open, onClose, weekStart, hotel, user, onSaved }) {
  const [weekOffset, setWeekOffset] = useState(0)
  const activeWeek = useMemo(() => addDays(weekStart, weekOffset * 7), [weekStart, weekOffset])
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(activeWeek, index)), [activeWeek])
  const [description, setDescription] = useState('')
  const [selected, setSelected] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setDescription('')
      setSelected([])
      setWeekOffset(0)
    }
  }, [open])

  useEffect(() => { setSelected([]) }, [weekOffset])

  const toggle = (date) => setSelected((current) => current.includes(date) ? current.filter((item) => item !== date) : [...current, date])

  const submit = async (event) => {
    event.preventDefault()
    if (!description.trim() || !selected.length || saving) return
    setSaving(true)
    try {
      await createPlanningWork({
        hotelId: hotel.id,
        description: description.trim(),
        dates: selected,
        createdBy: user?.name || '',
        createdByUserId: user?.auth_user_id || null,
      })
      onSaved?.()
      onClose?.()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} className="rs-insert-shell">
      <form onSubmit={submit} style={{ display: 'grid', gap: 18 }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button type="button" className="rs-btn rs-btn--ghost" onClick={onClose}>‹</button>
          <h2 style={{ margin: 0, fontFamily: 'Sora' }}>Nuovo lavoro</h2>
        </header>
        <label style={{ display: 'grid', gap: 8, fontWeight: 800 }}>
          Descrizione *
          <textarea className="rs-textarea" rows="3" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Es. Controllo caldaia" />
        </label>
        <div style={{ display: 'grid', gap: 9 }}>
          <strong>Settimana</strong>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: 4, border: '1px solid var(--rs-line)', borderRadius: 14, background: 'var(--rs-surface-2)' }}>
            <button type="button" className={`rs-btn ${weekOffset === 0 ? 'rs-btn--primary' : 'rs-btn--ghost'}`} onClick={() => setWeekOffset(0)}>Questa · {rangeLabel(weekStart)}</button>
            <button type="button" className={`rs-btn ${weekOffset === 1 ? 'rs-btn--primary' : 'rs-btn--ghost'}`} onClick={() => setWeekOffset(1)}>Seguente · {rangeLabel(addDays(weekStart, 7))}</button>
          </div>
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          <strong>Giorni *</strong>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {days.map((day) => {
              const value = iso(day)
              const active = selected.includes(value)
              return <button key={value} type="button" className={`rs-btn ${active ? 'rs-btn--primary' : 'rs-btn--ghost'}`} onClick={() => toggle(value)}>{label(day)}</button>
            })}
          </div>
        </div>
        <Button type="submit" variant="primary" size="lg" disabled={!description.trim() || !selected.length || saving}>✓ Crea lavoro su {selected.length} giorn{selected.length === 1 ? 'o' : 'i'}</Button>
      </form>
    </Sheet>
  )
}
