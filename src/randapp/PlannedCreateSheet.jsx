import { useEffect, useMemo, useState } from 'react'
import { insertPlanned } from '../planned-data.js'
import { HOTEL_LOCATIONS } from '../locations.js'
import { fetchDirectory } from '../users-data.js'
import { Button, Field, Sheet } from './ui.jsx'

const ISSUE_CATEGORIES = ['Idraulico', 'Elettrico', 'Climatizzazione', 'Arredo', 'Edilizio', 'Giardinaggio', 'Pulizia filtri', 'Idromassaggio', 'Extra Piani', 'Varie']

const toTimestamp = (value) => value ? new Date(value).getTime() : null

export default function PlannedCreateSheet({ open, onClose, hotel, user, onSaved }) {
  const catalog = HOTEL_LOCATIONS[hotel?.id]
  const [directory, setDirectory] = useState([])
  const [mode, setMode] = useState('camera')
  const [location, setLocation] = useState('')
  const [category, setCategory] = useState('Varie')
  const [notes, setNotes] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [scheduledUntil, setScheduledUntil] = useState('')
  const [assignees, setAssignees] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !hotel?.id) return
    let active = true
    fetchDirectory(hotel.id).then(({ users }) => { if (active) setDirectory(users || []) }).catch(() => { if (active) setDirectory([]) })
    return () => { active = false }
  }, [open, hotel?.id])

  const candidates = useMemo(() => directory.filter((person) => ['manutentore', 'Tecnico esterno'].includes(person.role)), [directory])
  const rooms = useMemo(() => catalog?.roomGroups?.flatMap((group) => group.rooms) || [], [catalog])
  const validLocation = mode === 'camera' ? rooms.includes(location.trim()) : location.trim().length > 0
  const validPeriod = scheduledAt && scheduledUntil && toTimestamp(scheduledUntil) >= toTimestamp(scheduledAt)
  const valid = validLocation && notes.trim() && validPeriod && assignees.length > 0

  const toggleAssignee = (person) => {
    setAssignees((current) => current.some((entry) => entry.id === person.id)
      ? current.filter((entry) => entry.id !== person.id)
      : [...current, { id: person.id, name: person.name, role: person.role }])
  }

  const reset = () => {
    setMode('camera')
    setLocation('')
    setCategory('Varie')
    setNotes('')
    setScheduledAt('')
    setScheduledUntil('')
    setAssignees([])
    setError('')
  }

  const close = () => { reset(); onClose?.() }

  const save = async (event) => {
    event.preventDefault()
    if (!valid || saving) return
    setSaving(true)
    setError('')
    try {
      await insertPlanned({
        hotelId: hotel.id,
        location: location.trim(),
        locationMode: mode,
        category,
        notes: notes.trim(),
        scheduledAt: toTimestamp(scheduledAt),
        scheduledUntil: toTimestamp(scheduledUntil),
        assignees,
        rooms: null,
        roomsDone: {},
        roomGroupIds: [],
        status: 'pending',
        createdBy: user?.name || '',
      })
      reset()
      onSaved?.()
      onClose?.()
    } catch (err) {
      setError(err?.message || 'Salvataggio non riuscito, riprova')
    } finally {
      setSaving(false)
    }
  }

  return <Sheet open={open} onClose={close} className="rs-insert-shell">
    <form onSubmit={save} style={{display:'grid',gap:14}}>
      <div>
        <h2 style={{margin:0,fontFamily:'Sora',fontSize:'1.2rem'}}>Nuovo lavoro pianificato</h2>
        <p style={{margin:'4px 0 0',color:'var(--rs-text-2)',fontSize:'.82rem'}}>{hotel?.name} · data, periodo e assegnazione</p>
      </div>

      <Field label="Camera o zona *">
        <div style={{display:'grid',gap:8}}>
          <div className="rs-segmented">
            <button type="button" className={mode === 'camera' ? 'active' : ''} onClick={() => { setMode('camera'); setLocation('') }}>Camera</button>
            <button type="button" className={mode === 'zona' ? 'active' : ''} onClick={() => { setMode('zona'); setLocation('') }}>Zona</button>
          </div>
          {mode === 'camera'
            ? <input className="rs-input" list="planned-room-list" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Es. 101" />
            : <input className="rs-input" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Es. Hall, cucina, giardino" />}
          <datalist id="planned-room-list">{rooms.map((room) => <option key={room} value={room} />)}</datalist>
          {location && !validLocation && <small style={{color:'var(--rs-danger)'}}>Camera o zona non valida.</small>}
        </div>
      </Field>

      <Field label="Categoria *">
        <select className="rs-input" value={category} onChange={(event) => setCategory(event.target.value)}>
          {ISSUE_CATEGORIES.map((item) => <option key={item}>{item}</option>)}
        </select>
      </Field>

      <Field label="Descrizione *">
        <textarea className="rs-textarea" rows="4" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Descrivi il lavoro da pianificare…" />
      </Field>

      <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:10}}>
        <Field label="Da *"><input className="rs-input" type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} /></Field>
        <Field label="A *"><input className="rs-input" type="datetime-local" min={scheduledAt} value={scheduledUntil} onChange={(event) => setScheduledUntil(event.target.value)} /></Field>
      </div>
      {scheduledAt && scheduledUntil && !validPeriod && <small style={{color:'var(--rs-danger)'}}>La data finale deve essere successiva a quella iniziale.</small>}

      <Field label="Assegna a *">
        <div className="rs-chips">
          {candidates.map((person) => <button type="button" key={person.id} className={`rs-chip ${assignees.some((entry) => entry.id === person.id) ? 'active' : ''}`} onClick={() => toggleAssignee(person)}>{person.name}</button>)}
        </div>
      </Field>

      {error && <p className="rs-error" role="alert">{error}</p>}
      <div className="rs-form-actions">
        <Button type="button" variant="ghost" onClick={close}>Annulla</Button>
        <Button type="submit" variant="primary" disabled={!valid || saving}>{saving ? 'Salvo…' : 'Pianifica lavoro'}</Button>
      </div>
    </form>
  </Sheet>
}
