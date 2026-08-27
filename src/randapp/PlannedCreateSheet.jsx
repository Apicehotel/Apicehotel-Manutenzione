import { useEffect, useMemo, useState } from 'react'
import { insertPlanned } from '../planned-data.js'
import { HOTEL_LOCATIONS } from '../locations.js'
import { fetchDirectory } from '../users-data.js'
import { Button, Field, Icon, Sheet } from './ui.jsx'

const CATEGORIES = [
  ['Idraulico', 'droplet'], ['Elettrico', 'zap'], ['Climatizzazione', 'wind'],
  ['Arredo', 'wrench'], ['Edilizio', 'hotel'], ['Giardinaggio', 'sparkles'],
  ['Pulizia filtri', 'wind'], ['Idromassaggio', 'droplet'], ['Extra Piani', 'hotel'], ['Varie', 'wrench'],
]

const normalizeText = (value) => String(value || '').trim().toLowerCase()
const toTimestamp = (value) => value ? new Date(value).getTime() : null
const isEvenRoom = (room) => {
  const n = Number(String(room).replace(/\D/g, ''))
  return Number.isFinite(n) && n % 2 === 0
}
const assigneeKey = (person) => {
  const raw = person?.auth_user_id || person?.legacy_id || person?.id || person?.name || ''
  const prefix = person?.role === 'Tecnico esterno' ? 'ext' : 'usr'
  return `${prefix}:${String(raw).trim().toLowerCase()}`
}

export default function PlannedCreateSheet({ open, onClose, hotel, user, onSaved }) {
  const catalog = HOTEL_LOCATIONS[hotel?.id]
  const [directory, setDirectory] = useState([])
  const [mode, setMode] = useState('camera')
  const [location, setLocation] = useState('')
  const [locationFocus, setLocationFocus] = useState(false)
  const [category, setCategory] = useState('Varie')
  const [notes, setNotes] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [scheduledUntil, setScheduledUntil] = useState('')
  const [assignees, setAssignees] = useState([])
  const [selectedFloorIds, setSelectedFloorIds] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !hotel?.id) return
    let active = true
    fetchDirectory(hotel.id)
      .then(({ users }) => { if (active) setDirectory(users || []) })
      .catch(() => { if (active) setDirectory([]) })
    return () => { active = false }
  }, [open, hotel?.id])

  const floorEntries = useMemo(
    () => (catalog?.roomGroups || []).map((group, index) => ({ group, index })),
    [catalog],
  )
  const rooms = useMemo(() => floorEntries.flatMap(({ group }) => group.rooms || []), [floorEntries])
  const zones = useMemo(() => catalog?.zones || [], [catalog])
  const isChecklist = category === 'Pulizia filtri' || category === 'Idromassaggio'
  const isExtraFloors = category === 'Extra Piani'
  const availableFloors = useMemo(() => {
    if (category !== 'Idromassaggio' || hotel?.id !== 'hotelgio') return floorEntries
    return floorEntries.filter(({ group }) => String(group.name || '').toLowerCase().startsWith('jazz'))
  }, [category, floorEntries, hotel?.id])

  useEffect(() => {
    setSelectedFloorIds((current) => current.filter((index) => availableFloors.some((entry) => entry.index === index)))
  }, [availableFloors])

  const selectedFloors = floorEntries.filter(({ index }) => selectedFloorIds.includes(index))
  const checklistRooms = selectedFloors.flatMap(({ group }) => (
    category === 'Idromassaggio' ? (group.rooms || []).filter(isEvenRoom) : (group.rooms || [])
  ))
  const candidates = useMemo(
    () => directory.filter((person) => ['manutentore', 'Tecnico esterno'].includes(person.role)),
    [directory],
  )
  const internal = candidates.filter((person) => person.role !== 'Tecnico esterno')
  const external = candidates.filter((person) => person.role === 'Tecnico esterno')
  const roomTrim = location.trim()
  const zoneMatch = useMemo(() => {
    const query = normalizeText(location)
    if (!query) return null
    return zones.find((zone) => normalizeText(zone.name) === query || (zone.aliases || []).some((alias) => normalizeText(alias) === query)) || null
  }, [location, zones])
  const resolvedLocation = mode === 'zona' && zoneMatch ? zoneMatch.name : roomTrim
  const validLocation = mode === 'camera' ? rooms.includes(roomTrim) : Boolean(zoneMatch)
  const locationSuggestions = useMemo(() => {
    const query = normalizeText(location)
    if (mode === 'camera') {
      const source = query ? rooms.filter((room) => normalizeText(room).includes(query)) : rooms
      return source.slice(0, 8).map((room) => ({ value: room, label: room, meta: floorEntries.find(({ group }) => (group.rooms || []).includes(room))?.group?.name || '' }))
    }
    const source = query
      ? zones.filter((zone) => normalizeText(zone.name).includes(query) || (zone.aliases || []).some((alias) => normalizeText(alias).includes(query)))
      : zones
    return source.slice(0, 8).map((zone) => ({ value: zone.name, label: zone.name, meta: (zone.aliases || []).slice(0, 2).join(' · ') }))
  }, [floorEntries, location, mode, rooms, zones])
  const validStart = Boolean(scheduledAt)
  const validEnd = !scheduledUntil || toTimestamp(scheduledUntil) >= toTimestamp(scheduledAt)
  const valid = isExtraFloors
    ? selectedFloorIds.length > 0 && validStart && Boolean(scheduledUntil) && validEnd && assignees.length > 0
    : isChecklist
      ? selectedFloorIds.length === 1 && validStart && validEnd && assignees.length > 0
      : validLocation && notes.trim() && validStart && validEnd && assignees.length > 0

  const toggleAssignee = (person) => {
    const key = assigneeKey(person)
    if (!key || key.endsWith(':')) return
    setAssignees((current) => current.some((entry) => entry.key === key)
      ? current.filter((entry) => entry.key !== key)
      : [...current, {
          key,
          id: person.auth_user_id || person.legacy_id || person.id || key,
          name: person.name,
          role: person.role,
        }])
  }

  const toggleFloor = (index) => setSelectedFloorIds((current) => {
    if (isExtraFloors) return current.includes(index) ? current.filter((value) => value !== index) : [...current, index]
    return current.includes(index) ? [] : [index]
  })

  const reset = () => {
    setMode('camera')
    setLocation('')
    setLocationFocus(false)
    setCategory('Varie')
    setNotes('')
    setScheduledAt('')
    setScheduledUntil('')
    setAssignees([])
    setSelectedFloorIds([])
    setError('')
  }
  const close = () => { reset(); onClose?.() }
  const chooseCategory = (next) => {
    setCategory(next)
    setSelectedFloorIds([])
    if (['Pulizia filtri', 'Idromassaggio', 'Extra Piani'].includes(next)) setLocation('')
  }
  const chooseLocation = (value) => {
    setLocation(value)
    setLocationFocus(false)
  }

  const save = async (event) => {
    event.preventDefault()
    if (!valid || saving) return
    setSaving(true)
    setError('')
    try {
      const floorLabel = selectedFloors.map(({ group }) => group.name).join(', ')
      const start = toTimestamp(scheduledAt)
      const end = scheduledUntil ? toTimestamp(scheduledUntil) : start
      const finalLocation = (isChecklist || isExtraFloors) ? floorLabel : resolvedLocation
      const resolvedNotes = notes.trim() || (isExtraFloors
        ? `Extra Piani — ${floorLabel}`
        : isChecklist ? `${category} ${floorLabel}` : '')
      const savedAssignees = assignees.map(({ id, name, role }) => ({ id, name, role }))
      await insertPlanned({
        hotelId: hotel.id,
        location: finalLocation,
        locationMode: (isChecklist || isExtraFloors) ? 'zona' : mode,
        category,
        notes: resolvedNotes,
        scheduledAt: start,
        scheduledUntil: end,
        assignees: savedAssignees,
        rooms: (isChecklist || isExtraFloors) ? checklistRooms : null,
        roomsDone: {},
        roomGroupIds: selectedFloorIds,
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

  const selectedNames = assignees.map((entry) => entry.name).filter(Boolean)

  const AssigneeCard = ({ person, isExternal = false }) => {
    const key = assigneeKey(person)
    const selected = assignees.some((entry) => entry.key === key)
    return (
      <button
        type="button"
        className={`rs-planned-assignee ${selected ? 'is-selected' : ''}`}
        aria-pressed={selected}
        onClick={() => toggleAssignee(person)}
      >
        <span className={`rs-planned-assignee__icon ${isExternal ? 'is-external' : ''}`}>
          <Icon name={isExternal ? 'wrench' : 'user'} />
        </span>
        <span className="rs-planned-assignee__text">
          <strong>{person.name}</strong>
          <small>{isExternal ? 'Tecnico esterno' : 'Manutentore'}</small>
        </span>
        <span className="rs-planned-assignee__check" aria-hidden="true">{selected ? '✓' : ''}</span>
      </button>
    )
  }

  return (
    <Sheet open={open} onClose={close} className="rs-insert-shell rs-planned-sheet">
      <form onSubmit={save} className="rs-planned-form">
        <header className="rs-planned-head">
          <div>
            <h2>Nuovo intervento</h2>
            <p>{hotel?.name} · pianifica e assegna</p>
          </div>
          <span className="rs-planned-head__icon"><Icon name="calendar" /></span>
        </header>

        <section className="rs-planned-block">
          {(isChecklist || isExtraFloors) ? (
            <Field label={isExtraFloors ? 'Piani *' : 'Piano *'}>
              <div className="rs-planned-pills">
                {availableFloors.map(({ group, index }) => {
                  const selected = selectedFloorIds.includes(index)
                  return (
                    <button key={`${group.name}-${index}`} type="button" className={selected ? 'is-selected' : ''} onClick={() => toggleFloor(index)}>
                      {group.name}
                    </button>
                  )
                })}
              </div>
              {!!selectedFloorIds.length && (
                <small className="rs-planned-hint">
                  {isExtraFloors ? `${selectedFloorIds.length} piani selezionati` : `${checklistRooms.length} camere da spuntare`}
                  {category === 'Idromassaggio' ? ' · solo camere pari' : ''}
                </small>
              )}
            </Field>
          ) : (
            <Field label="Dove *">
              <div className="rs-planned-location">
                <div className="rs-segmented">
                  <button type="button" className={mode === 'camera' ? 'active' : ''} onClick={() => { setMode('camera'); setLocation(''); setLocationFocus(false) }}>Camera</button>
                  <button type="button" className={mode === 'zona' ? 'active' : ''} onClick={() => { setMode('zona'); setLocation(''); setLocationFocus(false) }}>Zona</button>
                </div>
                <div className="rs-planned-autocomplete">
                  <input
                    className="rs-input"
                    value={location}
                    onFocus={() => setLocationFocus(true)}
                    onChange={(event) => { setLocation(event.target.value); setLocationFocus(true) }}
                    onBlur={() => window.setTimeout(() => setLocationFocus(false), 120)}
                    placeholder={mode === 'camera' ? 'Scrivi numero camera' : 'Scrivi o cerca una zona'}
                    autoComplete="off"
                    inputMode={mode === 'camera' ? 'numeric' : 'text'}
                    autoFocus
                  />
                  {locationFocus && locationSuggestions.length > 0 && (
                    <div className="rs-planned-suggestions" role="listbox">
                      {locationSuggestions.map((item) => (
                        <button key={`${mode}:${item.value}`} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => chooseLocation(item.value)}>
                          <span>{item.label}</span>{item.meta && <small>{item.meta}</small>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {location && validLocation && mode === 'zona' && zoneMatch && normalizeText(zoneMatch.name) !== normalizeText(location) && (
                  <small className="rs-planned-hint">Zona riconosciuta: {zoneMatch.name}</small>
                )}
                {location && !validLocation && <small className="rs-planned-error">{mode === 'camera' ? 'Seleziona una camera valida.' : 'Seleziona una zona valida.'}</small>}
              </div>
            </Field>
          )}
        </section>

        <section className="rs-planned-block">
          <Field label="Categoria *">
            <div className="rs-planned-categories">
              {CATEGORIES.map(([label, icon]) => (
                <button key={label} type="button" className={category === label ? 'is-selected' : ''} onClick={() => chooseCategory(label)}>
                  <Icon name={icon} /><span>{label}</span>
                </button>
              ))}
            </div>
          </Field>
        </section>

        <section className="rs-planned-block rs-planned-block--compact">
          <Field label={isChecklist || isExtraFloors ? 'Descrizione' : 'Descrizione *'}>
            <textarea className="rs-textarea rs-planned-description" rows="2" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Cosa bisogna fare?" />
          </Field>
        </section>

        <section className="rs-planned-block rs-planned-block--compact">
          <Field label={isExtraFloors ? 'Periodo *' : 'Quando *'}>
            <div className="rs-planned-dates">
              <label><span>Da</span><input className="rs-input" type={isExtraFloors ? 'date' : 'datetime-local'} value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} /></label>
              <label><span>A {isExtraFloors ? '' : <em>opzionale</em>}</span><input className="rs-input" type={isExtraFloors ? 'date' : 'datetime-local'} min={scheduledAt || undefined} value={scheduledUntil} onChange={(event) => setScheduledUntil(event.target.value)} /></label>
            </div>
            {scheduledAt && scheduledUntil && !validEnd && <small className="rs-planned-error">La data finale deve essere successiva alla data iniziale.</small>}
          </Field>
        </section>

        <section className="rs-planned-block rs-planned-people">
          <div className="rs-planned-section-head">
            <div><strong>Chi lo esegue *</strong><small>Puoi scegliere più persone</small></div>
            {assignees.length > 0 && <span>{assignees.length} selezionat{assignees.length === 1 ? 'o' : 'i'}</span>}
          </div>

          {internal.length > 0 && (
            <div className="rs-planned-people-group">
              <small className="rs-planned-group-title">Personale interno</small>
              <div className="rs-planned-assignee-grid">
                {internal.map((person) => <AssigneeCard key={assigneeKey(person)} person={person} />)}
              </div>
            </div>
          )}

          {external.length > 0 && (
            <div className="rs-planned-people-group">
              <small className="rs-planned-group-title">Tecnici esterni</small>
              <div className="rs-planned-assignee-grid">
                {external.map((person) => <AssigneeCard key={assigneeKey(person)} person={person} isExternal />)}
              </div>
            </div>
          )}

          {!candidates.length && <small className="rs-planned-error">Nessun manutentore o tecnico disponibile per questa struttura.</small>}
          {selectedNames.length > 0 && <div className="rs-planned-selected-summary"><Icon name="check" /><span>{selectedNames.join(', ')}</span></div>}
        </section>

        {error && <p className="rs-error" role="alert">{error}</p>}

        <footer className="rs-planned-actions">
          <Button type="button" variant="ghost" onClick={close}>Annulla</Button>
          <Button type="submit" variant="primary" disabled={!valid || saving}>{saving ? 'Salvo…' : 'Pianifica'}</Button>
        </footer>
      </form>
    </Sheet>
  )
}
