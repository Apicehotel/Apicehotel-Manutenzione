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
const toTimestamp = (value) => value ? new Date(value).getTime() : null
const isEvenRoom = (room) => { const n = Number(String(room).replace(/\D/g, '')); return Number.isFinite(n) && n % 2 === 0 }

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
  const [selectedFloorIds, setSelectedFloorIds] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !hotel?.id) return
    let active = true
    fetchDirectory(hotel.id).then(({ users }) => { if (active) setDirectory(users || []) }).catch(() => { if (active) setDirectory([]) })
    return () => { active = false }
  }, [open, hotel?.id])

  const floorEntries = useMemo(() => (catalog?.roomGroups || []).map((group, index) => ({ group, index })), [catalog])
  const rooms = useMemo(() => floorEntries.flatMap(({ group }) => group.rooms || []), [floorEntries])
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
  const checklistRooms = selectedFloors.flatMap(({ group }) => category === 'Idromassaggio' ? (group.rooms || []).filter(isEvenRoom) : (group.rooms || []))
  const candidates = useMemo(() => directory.filter((person) => ['manutentore', 'Tecnico esterno'].includes(person.role)), [directory])
  const internal = candidates.filter((person) => person.role !== 'Tecnico esterno')
  const external = candidates.filter((person) => person.role === 'Tecnico esterno')
  const roomTrim = location.trim()
  const validLocation = mode === 'camera' ? rooms.includes(roomTrim) : roomTrim.length > 0
  const validStart = Boolean(scheduledAt)
  const validEnd = !scheduledUntil || toTimestamp(scheduledUntil) >= toTimestamp(scheduledAt)
  const valid = isExtraFloors
    ? selectedFloorIds.length > 0 && validStart && Boolean(scheduledUntil) && validEnd && assignees.length > 0
    : isChecklist
      ? selectedFloorIds.length === 1 && validStart && validEnd && assignees.length > 0
      : validLocation && notes.trim() && validStart && validEnd && assignees.length > 0

  const toggleAssignee = (person) => setAssignees((current) => current.some((entry) => entry.id === person.id)
    ? current.filter((entry) => entry.id !== person.id)
    : [...current, { id: person.id, name: person.name, role: person.role }])

  const toggleFloor = (index) => setSelectedFloorIds((current) => {
    if (isExtraFloors) return current.includes(index) ? current.filter((value) => value !== index) : [...current, index]
    return current.includes(index) ? [] : [index]
  })

  const reset = () => {
    setMode('camera'); setLocation(''); setCategory('Varie'); setNotes(''); setScheduledAt(''); setScheduledUntil('')
    setAssignees([]); setSelectedFloorIds([]); setError('')
  }
  const close = () => { reset(); onClose?.() }
  const chooseCategory = (next) => {
    setCategory(next); setSelectedFloorIds([])
    if (['Pulizia filtri', 'Idromassaggio', 'Extra Piani'].includes(next)) setLocation('')
  }

  const save = async (event) => {
    event.preventDefault()
    if (!valid || saving) return
    setSaving(true); setError('')
    try {
      const floorLabel = selectedFloors.map(({ group }) => group.name).join(', ')
      const start = toTimestamp(scheduledAt)
      const end = scheduledUntil ? toTimestamp(scheduledUntil) : start
      const resolvedLocation = (isChecklist || isExtraFloors) ? floorLabel : roomTrim
      const resolvedNotes = notes.trim() || (isExtraFloors ? `Extra Piani — ${floorLabel}` : isChecklist ? `${category} ${floorLabel}` : '')
      await insertPlanned({
        hotelId: hotel.id, location: resolvedLocation, locationMode: (isChecklist || isExtraFloors) ? 'zona' : mode,
        category, notes: resolvedNotes, scheduledAt: start, scheduledUntil: end, assignees,
        rooms: (isChecklist || isExtraFloors) ? checklistRooms : null, roomsDone: {}, roomGroupIds: selectedFloorIds,
        status: 'pending', createdBy: user?.name || '',
      })
      reset(); onSaved?.(); onClose?.()
    } catch (err) { setError(err?.message || 'Salvataggio non riuscito, riprova') }
    finally { setSaving(false) }
  }

  const choiceStyle = (active) => ({
    border: `1px solid ${active ? 'var(--rs-cyan)' : 'var(--rs-line)'}`,
    background: active ? 'color-mix(in srgb,var(--rs-cyan) 12%,var(--rs-surface))' : 'var(--rs-surface)',
    color: active ? 'var(--rs-text)' : 'var(--rs-text-2)', borderRadius:12, minHeight:40, padding:'8px 11px', fontWeight:750, cursor:'pointer',
  })

  const AssigneeRow = ({ person, isExternal = false }) => {
    const selected = assignees.some((entry) => entry.id === person.id)
    return <button type="button" onClick={() => toggleAssignee(person)} style={{width:'100%',display:'grid',gridTemplateColumns:'38px minmax(0,1fr) 24px',alignItems:'center',gap:10,padding:'9px 10px',borderRadius:13,border:`1px solid ${selected ? 'var(--rs-line-strong)' : 'var(--rs-line)'}`,background:selected?'var(--rs-surface-3)':'var(--rs-surface)',color:'var(--rs-text)',textAlign:'left',cursor:'pointer'}}>
      <span style={{width:38,height:38,borderRadius:12,display:'grid',placeItems:'center',background:'var(--rs-surface-2)',color:isExternal?'var(--rs-warn)':'var(--rs-cyan)'}}><Icon name={isExternal ? 'wrench' : 'user'} /></span>
      <span style={{minWidth:0}}><strong style={{display:'block',fontSize:'.88rem'}}>{person.name}</strong><small style={{display:'block',color:'var(--rs-text-3)',marginTop:2}}>{person.role}</small></span>
      <span style={{width:20,height:20,borderRadius:7,border:`1px solid ${selected?'var(--rs-cyan)':'var(--rs-line-strong)'}`,background:selected?'var(--rs-cyan)':'transparent',display:'grid',placeItems:'center',color:'white'}}>{selected ? '✓' : ''}</span>
    </button>
  }

  return <Sheet open={open} onClose={close} className="rs-insert-shell">
    <form onSubmit={save} style={{display:'grid',gap:16}}>
      <div><h2 style={{margin:0,fontFamily:'Sora',fontSize:'1.2rem'}}>Nuovo intervento pianificato</h2><p style={{margin:'4px 0 0',color:'var(--rs-text-2)',fontSize:'.82rem'}}>{hotel?.name} · pianificazione operativa</p></div>

      {(isChecklist || isExtraFloors) ? <Field label={isExtraFloors ? 'Piani *' : 'Piano *'}>
        <div style={{display:'flex',flexWrap:'wrap',gap:7}}>{availableFloors.map(({ group, index }) => <button key={`${group.name}-${index}`} type="button" style={choiceStyle(selectedFloorIds.includes(index))} onClick={() => toggleFloor(index)}>{group.name}</button>)}</div>
        {!!selectedFloorIds.length && <small style={{display:'block',marginTop:7,color:'var(--rs-text-3)'}}>{isExtraFloors ? `${selectedFloorIds.length} piani selezionati` : `${checklistRooms.length} camere da spuntare`}{category === 'Idromassaggio' ? ' · solo camere pari' : ''}</small>}
      </Field> : <Field label="Camera o zona *"><div style={{display:'grid',gap:8}}>
        <div className="rs-segmented"><button type="button" className={mode === 'camera' ? 'active' : ''} onClick={() => { setMode('camera'); setLocation('') }}>Camera</button><button type="button" className={mode === 'zona' ? 'active' : ''} onClick={() => { setMode('zona'); setLocation('') }}>Zona</button></div>
        {mode === 'camera' ? <input className="rs-input" list="planned-room-list" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Numero camera" autoFocus /> : <input className="rs-input" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Es. Hall, cucina, giardino" autoFocus />}
        <datalist id="planned-room-list">{rooms.map((room) => <option key={room} value={room} />)}</datalist>{location && !validLocation && <small style={{color:'var(--rs-danger)'}}>{mode === 'camera' ? 'Camera non valida.' : 'Inserisci una zona.'}</small>}
      </div></Field>}

      <Field label="Categoria *"><div style={{display:'flex',flexWrap:'wrap',gap:7}}>{CATEGORIES.map(([label, icon]) => <button key={label} type="button" style={choiceStyle(category === label)} onClick={() => chooseCategory(label)}><span style={{display:'inline-flex',alignItems:'center',gap:6}}><Icon name={icon} /> {label}</span></button>)}</div></Field>
      <Field label={isChecklist || isExtraFloors ? 'Descrizione (opzionale)' : 'Descrizione *'}><textarea className="rs-textarea" rows="3" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Descrivi l'intervento…" /></Field>

      <Field label={isExtraFloors ? 'Periodo *' : 'Data e ora *'}><div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:10}}>
        <label style={{display:'grid',gap:5,fontSize:'.75rem',color:'var(--rs-text-2)'}}>Da<input className="rs-input" type={isExtraFloors ? 'date' : 'datetime-local'} value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} /></label>
        <label style={{display:'grid',gap:5,fontSize:'.75rem',color:'var(--rs-text-2)'}}>A{isExtraFloors ? '' : ' (opzionale)'}<input className="rs-input" type={isExtraFloors ? 'date' : 'datetime-local'} min={scheduledAt || undefined} value={scheduledUntil} onChange={(event) => setScheduledUntil(event.target.value)} /></label>
      </div>{scheduledAt && scheduledUntil && !validEnd && <small style={{display:'block',marginTop:7,color:'var(--rs-danger)'}}>La data finale deve essere successiva alla data iniziale.</small>}</Field>

      <Field label="Assegna a *"><div style={{display:'grid',gap:8}}>
        {internal.length > 0 && <><small style={{fontWeight:800,color:'var(--rs-text-3)',textTransform:'uppercase',letterSpacing:'.05em'}}>Personale interno</small>{internal.map((person) => <AssigneeRow key={person.id} person={person} />)}</>}
        {external.length > 0 && <><small style={{fontWeight:800,color:'var(--rs-text-3)',textTransform:'uppercase',letterSpacing:'.05em',marginTop:4}}>Tecnici esterni</small>{external.map((person) => <AssigneeRow key={person.id} person={person} isExternal />)}</>}
        {!candidates.length && <small style={{color:'var(--rs-danger)'}}>Nessun manutentore o tecnico disponibile per questa struttura.</small>}
      </div></Field>

      {error && <p className="rs-error" role="alert">{error}</p>}
      {!valid && !error && <small style={{color:'var(--rs-text-3)'}}>Compila i campi obbligatori (*) per pianificare l'intervento.</small>}
      <div className="rs-form-actions"><Button type="button" variant="ghost" onClick={close}>Annulla</Button><Button type="submit" variant="primary" disabled={!valid || saving}>{saving ? 'Salvo…' : 'Pianifica intervento'}</Button></div>
    </form>
  </Sheet>
}
