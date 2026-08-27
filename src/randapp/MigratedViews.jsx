import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchPlanned, insertPlanned, updatePlannedRow, deletePlannedRow, subscribePlanned } from '../planned-data.js'
import { fetchUrgents, insertUrgent, updateUrgentRow, subscribeUrgents } from '../urgents-data.js'
import { fetchFeedback, insertFeedback, subscribeFeedback } from '../feedback-data.js'
import { changeOwnPin, updateOwnProfile, setOwnPresence } from '../auth-data.js'
import { PlanningWork, PlanningSale } from '../planning.jsx'
import { TemperatureSensors } from '../temperature.jsx'
import { Housekeeping } from '../housekeeping.jsx'
import { Button, Card, EmptyState, Field, Icon, IconButton, Badge, Spinner, TextInput, Sheet, ConfirmDialog } from './ui.jsx'
import { canCreatePlanned, ISSUE_CATEGORIES, compressPhotoAsDataUrl } from './helpers.js'

const fmt = (value) => value ? new Date(value).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'
const whatsappLink = (phone) => {
  const digits = String(phone || '').replace(/[^\d+]/g, '')
  return digits ? `https://wa.me/${digits.replace(/^\+/, '')}` : null
}

function PageTitle({ title, subtitle, action }) {
  return <div className="rs-page-title"><div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{action}</div>
}

function statusTone(status) {
  if (['done', 'completata'].includes(status)) return 'done'
  if (['presa_in_carico', 'in_progress'].includes(status)) return 'tecnico'
  if (['da_finire', 'waiting'].includes(status)) return 'waiting'
  return 'todo'
}

function StatusPill({ status }) {
  const labels = { pending: 'Da fare', in_progress: 'In corso', da_finire: 'Da finire', done: 'Fatto', aperta: 'Aperta', presa_in_carico: 'Presa in carico', completata: 'Completata' }
  return <span className={`rs-badge rs-badge--${statusTone(status)}`}>{labels[status] || status}</span>
}

function isAssignedTo(item, user) {
  const name = String(user?.name || '').trim().toLowerCase()
  if (!name) return false
  return (item.assignees || []).some((a) => String(a?.name || a || '').trim().toLowerCase() === name)
}

export function InterventionsView({ hotel, user, users, createSignal }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('active')
  const [selected, setSelected] = useState(null)
  const [creating, setCreating] = useState(false)
  const canManageAll = canCreatePlanned(user) || user?.role === 'manutentore'
  const load = useCallback(async () => { const result = await fetchPlanned(hotel.id); setItems(result.items || []); setLoading(false) }, [hotel.id])
  useEffect(() => { load(); return subscribePlanned(hotel.id, load) }, [hotel.id, load])
  useEffect(() => { if (createSignal && canManageAll) setCreating(true) }, [createSignal])
  const visible = useMemo(() => items.filter((item) => filter === 'all' || (filter === 'done' ? item.status === 'done' : item.status !== 'done')), [items, filter])
  const doUpdate = async (id, changes) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...changes } : i)))
    try { await updatePlannedRow(id, { ...changes, hotelId: hotel.id }) } finally { load() }
  }
  const doDelete = async (id) => { await deletePlannedRow(id, hotel.id); load() }
  if (creating) return <NewPlannedForm hotel={hotel} user={user} users={users} onCancel={() => setCreating(false)} onSaved={() => { setCreating(false); load() }} />
  return <div data-testid="interventions-view">
    <PageTitle title="Interventi" subtitle={`${hotel.name} · ${items.filter(i => i.status !== 'done').length} aperti`}
      action={canManageAll && <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>Nuova</Button>} />
    <div className="rs-segmented rs-migrated-tabs">
      {[['active','Aperti'],['done','Fatti'],['all','Tutti']].map(([id,label]) => <button type="button" key={id} className={filter===id?'active':''} onClick={()=>setFilter(id)}>{label}</button>)}
    </div>
    {loading ? <Spinner label="Carico interventi…" /> : !visible.length ? <EmptyState icon="wrench" title="Nessun intervento">Non ci sono elementi per questo filtro.</EmptyState> : <div className="rs-migrated-list">
      {visible.map((item) => {
        const assigned = isAssignedTo(item, user)
        const roomsTotal = Array.isArray(item.rooms) ? item.rooms.length : 0
        const roomsDone = Object.keys(item.roomsDone || {}).length
        return <Card as="button" key={item.id} className={`rs-card--pad rs-op-card ${assigned ? 'rs-op-card--assigned' : ''}`} onClick={() => setSelected(item)}>
          <div className="rs-op-card__head"><div><strong>{item.location || 'Intervento'}</strong><small>{item.category || 'Manutenzione'} · {fmt(item.scheduledAt)}</small></div><StatusPill status={item.status} /></div>
          {item.notes && <p>{item.notes}</p>}
          {roomsTotal > 0 && <small>{roomsDone}/{roomsTotal} camere completate</small>}
          {!!item.assignees?.length && <small>Assegnato a: {item.assignees.map(p => p.name || p).join(', ')}</small>}
        </Card>
      })}
    </div>}
    {selected && <PlannedDetail item={selected} user={user} onClose={() => setSelected(null)} onUpdate={doUpdate} onDelete={doDelete} />}
  </div>
}

function NewPlannedForm({ hotel, user, users, onCancel, onSaved }) {
  const [location, setLocation] = useState('')
  const [category, setCategory] = useState(ISSUE_CATEGORIES[0])
  const [notes, setNotes] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [roomsText, setRoomsText] = useState('')
  const [assigneeIds, setAssigneeIds] = useState([])
  const [saving, setSaving] = useState(false)
  const assignable = (users || []).filter((p) => ['manutentore', 'Tecnico esterno'].includes(p.role))
  const toggleAssignee = (id) => setAssigneeIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])

  const submit = async (e) => {
    e.preventDefault()
    if (!location.trim() || saving) return
    setSaving(true)
    const rooms = roomsText.split(/[,\n]/).map((r) => r.trim()).filter(Boolean)
    const assignees = assignable.filter((p) => assigneeIds.includes(p.id)).map((p) => ({ name: p.name }))
    try {
      await insertPlanned({
        hotelId: hotel.id,
        location: location.trim(),
        locationMode: 'zona',
        category,
        notes: notes.trim() || null,
        scheduledAt: scheduledAt ? new Date(scheduledAt).getTime() : null,
        rooms: rooms.length ? rooms : null,
        assignees: assignees.length ? assignees : [],
        status: 'pending',
        createdBy: user?.name || 'App',
      })
      onSaved()
    } finally { setSaving(false) }
  }

  return (
    <form className="rs-form" onSubmit={submit} data-testid="new-planned-form">
      <div className="rs-form__head">
        <IconButton icon="chevronLeft" label="Indietro" onClick={onCancel} />
        <div><h2>Nuovo intervento</h2><p>{hotel.name} · stato iniziale Da fare</p></div>
      </div>
      <Field label="Camera o zona">
        <TextInput value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Es. Camera 214 o Hall" required />
      </Field>
      <fieldset className="rs-fieldset">
        <legend>Categoria</legend>
        <div className="rs-chips">
          {ISSUE_CATEGORIES.map((item) => (
            <button type="button" key={item} className={`rs-chip ${category === item ? 'active' : ''}`} onClick={() => setCategory(item)}>{item}</button>
          ))}
        </div>
      </fieldset>
      <Field label="Descrizione del lavoro">
        <textarea className="rs-textarea" rows="4" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Cosa va fatto" />
      </Field>
      <Field label="Data programmata (opzionale)">
        <input type="date" className="rs-select" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
      </Field>
      <Field label="Camere da spuntare (opzionale)" hint="Una per riga o separate da virgola, per lavori su più stanze">
        <textarea className="rs-textarea" rows="2" value={roomsText} onChange={(e) => setRoomsText(e.target.value)} placeholder={'101, 102, 103'} />
      </Field>
      {!!assignable.length && (
        <fieldset className="rs-fieldset">
          <legend>Assegna a (opzionale)</legend>
          <div className="rs-chips">
            {assignable.map((p) => (
              <button type="button" key={p.id} className={`rs-chip ${assigneeIds.includes(p.id) ? 'active' : ''}`} onClick={() => toggleAssignee(p.id)}>{p.name}</button>
            ))}
          </div>
        </fieldset>
      )}
      <div className="rs-form-actions">
        <Button type="button" variant="ghost" onClick={onCancel}>Annulla</Button>
        <Button variant="primary" icon="plus" disabled={!location.trim() || saving}>{saving ? 'Invio…' : 'Crea intervento'}</Button>
      </div>
    </form>
  )
}

function PlannedDetail({ item, user, onClose, onUpdate, onDelete }) {
  const [piece, setPiece] = useState('')
  const [asking, setAsking] = useState('')
  const [photo, setPhoto] = useState(null)
  const [confirmDel, setConfirmDel] = useState(false)
  const assigned = isAssignedTo(item, user)
  const canManage = canCreatePlanned(user) || ['manutentore'].includes(user?.role)
  const canComplete = (canManage || assigned) && item.status !== 'done' && item.status !== 'waiting'
  const canDelete = canManage
  const rooms = Array.isArray(item.rooms) ? item.rooms : null
  const roomsDone = item.roomsDone || {}
  const doneCount = rooms ? rooms.filter((r) => roomsDone[r]).length : 0
  const pct = rooms?.length ? Math.round((doneCount / rooms.length) * 100) : 0

  const toggleRoom = (room) => {
    if (!canComplete) return
    const next = { ...roomsDone }
    if (next[room]) delete next[room]
    else next[room] = { by: user?.name, at: Date.now() }
    onUpdate(item.id, { roomsDone: next })
  }
  const complete = () => { onUpdate(item.id, { status: 'done', photoAfter: photo, completedBy: user?.name, completedAt: Date.now() }); onClose() }
  const confirmPiece = () => { if (!piece.trim()) return; onUpdate(item.id, { status: 'waiting', pieceName: piece.trim() }); onClose() }
  const pieceArrived = () => { onUpdate(item.id, { status: 'pending' }); onClose() }

  return (
    <Sheet open onClose={onClose} className="rs-issue-detail">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <StatusPill status={item.status} />
        {canDelete && <IconButton icon="trash" label="Elimina" style={{ marginLeft: 'auto' }} onClick={() => setConfirmDel(true)} />}
      </div>
      <h2 className="rs-detail-room">{item.location || 'Intervento'}</h2>
      {item.notes && <p className="rs-detail-desc">{item.notes}</p>}
      <p className="rs-detail-origin">{item.category || 'Manutenzione'}{item.scheduledAt ? ` · ${fmt(item.scheduledAt)}` : ''}</p>
      {!!item.assignees?.length && <p className="rs-detail-origin">Assegnato a: {item.assignees.map((p) => p.name || p).join(', ')}</p>}

      {rooms && rooms.length > 0 && (
        <div className="rs-note">
          <p style={{ margin: '0 0 8px', fontWeight: 700 }}>{doneCount}/{rooms.length} camere completate ({pct}%)</p>
          <div className="rs-chips">
            {rooms.map((room) => (
              <button type="button" key={room} className={`rs-chip ${roomsDone[room] ? 'active' : ''}`} disabled={!canComplete} onClick={() => toggleRoom(room)}>{room}</button>
            ))}
          </div>
        </div>
      )}

      {item.status === 'waiting' && <div className="rs-note rs-note--waiting">In attesa del pezzo: <strong>{item.pieceName}</strong></div>}
      {item.status === 'done' && <div className="rs-note rs-note--done">Completato da <strong>{item.completedBy}</strong>{(item.photoAfter || item.photoAfterPath) && <img className="rs-photo-preview" src={item.photoAfter || item.photoAfterPath} alt="Foto completamento" style={{ marginTop: 8 }} />}</div>}

      {canComplete && !asking && (
        <div className="rs-actions-stack">
          <p className="rs-actions-heading">Azioni</p>
          <Button variant="ghost" icon="package" onClick={() => setAsking('piece')}>Serve pezzo</Button>
          <label className="rs-photo-action" style={{ borderStyle: 'dashed' }}>
            <input type="file" accept="image/*" onChange={async (e) => setPhoto(await compressPhotoAsDataUrl(e.target.files?.[0]))} />
            <Icon name="camera" /><strong>{photo ? 'Foto aggiunta' : 'Aggiungi foto completamento'}</strong>
          </label>
          {photo && <img className="rs-photo-preview" src={photo} alt="Anteprima" />}
          <Button variant="primary" icon="check" onClick={complete}>Segna completato</Button>
        </div>
      )}
      {item.status === 'waiting' && canManage && <div className="rs-actions-stack"><Button variant="primary" onClick={pieceArrived}>Pezzo arrivato, torna Da fare</Button></div>}

      {asking === 'piece' && (
        <div className="rs-actions-stack">
          <Field label="Nome del pezzo in attesa"><TextInput value={piece} onChange={(e) => setPiece(e.target.value)} placeholder="Es. Faretto LED IP65" /></Field>
          <div className="rs-form-actions"><Button variant="ghost" onClick={() => setAsking('')}>Annulla</Button><Button variant="primary" disabled={!piece.trim()} onClick={confirmPiece}>Conferma</Button></div>
        </div>
      )}

      <ConfirmDialog open={confirmDel} title="Eliminare l'intervento?" message="L'azione non è reversibile." confirmLabel="Elimina" danger
        onCancel={() => setConfirmDel(false)} onConfirm={() => { onDelete(item.id); setConfirmDel(false); onClose() }} />
    </Sheet>
  )
}

export function PlanningWorkView({ hotel }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => { const result = await fetchPlanned(hotel.id); setItems(result.items || []); setLoading(false) }, [hotel.id])
  useEffect(() => { load(); return subscribePlanned(hotel.id, load) }, [hotel.id, load])
  if (loading) return <Spinner label="Carico planning…" />
  return <div className="rs-legacy rs-legacy--planning" data-testid="planning-work-view"><PlanningWork items={items} onOpen={()=>{}} /></div>
}

export function PlanningSaleView({ hotel, user }) {
  return <div className="rs-legacy rs-legacy--planning" data-testid="planning-sale-view"><PlanningSale hotel={hotel} user={user} /></div>
}

export function UrgentView({ hotel, user }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState('')
  const [creating, setCreating] = useState(false)
  const load = useCallback(async () => { const result = await fetchUrgents(hotel.id); setItems(result.items || []); setLoading(false) }, [hotel.id])
  useEffect(() => { load(); return subscribeUrgents(hotel.id, load) }, [hotel.id, load])
  const create = async (e) => { e.preventDefault(); if (!note.trim()) return; await insertUrgent({ hotelId: hotel.id, note: note.trim(), createdBy: user?.name, severity: 'urgente' }); setNote(''); setCreating(false); load() }
  const take = async (item) => { await updateUrgentRow(item.id, { hotelId: hotel.id, status: 'presa_in_carico', takenBy: user?.name }); load() }
  const done = async (item) => { await updateUrgentRow(item.id, { hotelId: hotel.id, status: 'completata', completedBy: user?.name }); load() }
  return <div data-testid="urgent-view">
    <PageTitle title="Avvisi urgenti" subtitle={`${hotel.name} · ${items.filter(i=>i.status!=='completata').length} attivi`} action={<Button icon="plus" onClick={()=>setCreating(v=>!v)}>Nuovo</Button>} />
    {creating && <Card className="rs-card--pad"><form className="rs-migrated-form" onSubmit={create}><Field label="Messaggio urgente"><textarea className="rs-textarea" rows="3" value={note} onChange={e=>setNote(e.target.value)} placeholder="Descrivi l'urgenza…" /></Field><Button type="submit" disabled={!note.trim()}>Invia avviso</Button></form></Card>}
    {loading ? <Spinner label="Carico avvisi…" /> : !items.length ? <EmptyState icon="warning" title="Nessun avviso urgente">La struttura non ha avvisi attivi.</EmptyState> : <div className="rs-migrated-list">
      {items.map(item => <Card key={item.id} className="rs-card--pad rs-op-card">
        <div className="rs-op-card__head"><div><strong>{item.location || 'Avviso urgente'}</strong><small>{fmt(item.createdAt)} · {item.createdBy || '—'}</small></div><StatusPill status={item.status}/></div>
        <p>{item.note}</p>
        {item.status==='aperta' && <div className="rs-op-card__actions"><Button variant="outline" onClick={()=>take(item)}>Prendi in carico</Button></div>}
        {item.status==='presa_in_carico' && <div className="rs-op-card__actions"><Button icon="check" onClick={()=>done(item)}>Completa</Button></div>}
      </Card>)}
    </div>}
  </div>
}

export function TemperatureView({ hotel }) {
  return <div className="rs-legacy rs-legacy--temperature" data-testid="temperature-view"><TemperatureSensors hotel={hotel} /></div>
}

export function HousekeepingView({ hotel, user }) {
  return <div className="rs-legacy rs-legacy--housekeeping" data-testid="housekeeping-view"><Housekeeping hotel={hotel} user={user} /></div>
}

export function TechnicianDirectoryView({ users = [], hotel }) {
  const technicians = users.filter(person => person.role === 'Tecnico esterno').sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'it'))
  return <div data-testid="technicians-view"><PageTitle title="Rubrica tecnici" subtitle={hotel.name} />
    {!technicians.length ? <EmptyState icon="phone" title="Nessun tecnico esterno">Aggiungi i tecnici da Gestione utenti con ruolo “Tecnico esterno”.</EmptyState> : <div className="rs-migrated-list">{technicians.map(tech => { const wa=whatsappLink(tech.phone); return <Card className="rs-card--pad rs-tech-card" key={tech.id || tech.name}><div><strong>{tech.name}</strong><small>{tech.phone || 'Numero non inserito'}</small></div>{wa && <a className="rs-btn rs-btn--outline rs-btn--sm" href={wa} target="_blank" rel="noopener noreferrer"><Icon name="message"/><span>WhatsApp</span></a>}</Card> })}</div>}
  </div>
}

export function FeedbackView({ hotel, user, received = false }) {
  const [items, setItems] = useState([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => { if (!received) return; const result=await fetchFeedback(hotel.id); setItems(result.items || []) }, [hotel.id, received])
  useEffect(()=>{ if (!received) return undefined; load(); return subscribeFeedback(hotel.id, load) },[hotel.id,received,load])
  const submit=async(e)=>{e.preventDefault();if(!text.trim())return;setBusy(true);try{await insertFeedback(hotel.id,user?.name||'Utente',text.trim());setText('')}finally{setBusy(false)}}
  if (received) return <div data-testid="feedback-received-view"><PageTitle title="Feedback ricevuti" subtitle={hotel.name}/>{!items.length?<EmptyState icon="message" title="Nessun feedback">Non sono ancora arrivati messaggi.</EmptyState>:<div className="rs-migrated-list">{items.map(item=><Card key={item.id} className="rs-card--pad rs-op-card"><div className="rs-op-card__head"><strong>{item.userName||'Utente'}</strong><small>{fmt(item.createdAt)}</small></div><p>{item.text}</p></Card>)}</div>}</div>
  return <div data-testid="feedback-view"><PageTitle title="Invia feedback" subtitle="Suggerimenti sull'app"/><Card className="rs-card--pad"><form className="rs-migrated-form" onSubmit={submit}><Field label="Messaggio"><textarea className="rs-textarea" rows="6" value={text} onChange={e=>setText(e.target.value)} placeholder="Scrivi qui il tuo suggerimento…" /></Field><Button type="submit" disabled={busy||!text.trim()}>{busy?'Invio…':'Invia feedback'}</Button></form></Card></div>
}

export function PinView() {
  const [currentPin,setCurrentPin]=useState(''),[newPin,setNewPin]=useState(''),[confirmPin,setConfirmPin]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('')
  const submit=async(e)=>{e.preventDefault();setMessage('');setError('');if(newPin.length!==4||newPin!==confirmPin)return setError('Il nuovo PIN deve essere di 4 cifre e coincidere.');setBusy(true);try{await changeOwnPin({currentPin,newPin});setCurrentPin('');setNewPin('');setConfirmPin('');setMessage('PIN aggiornato correttamente.')}catch(err){setError(err?.message||'Cambio PIN non riuscito')}finally{setBusy(false)}}
  const pinProps=(value,setter)=>({value,inputMode:'numeric',autoComplete:'off',onChange:e=>setter(e.target.value.replace(/\D/g,'').slice(0,4))})
  return <div data-testid="pin-view"><PageTitle title="Cambia PIN" subtitle="Proteggi il tuo account"/><Card className="rs-card--pad"><form className="rs-migrated-form" onSubmit={submit}><Field label="PIN attuale"><TextInput icon="lock" {...pinProps(currentPin,setCurrentPin)} /></Field><Field label="Nuovo PIN"><TextInput icon="lock" {...pinProps(newPin,setNewPin)} /></Field><Field label="Ripeti nuovo PIN"><TextInput icon="lock" {...pinProps(confirmPin,setConfirmPin)} /></Field>{error&&<p className="rs-error">{error}</p>}{message&&<p className="rs-success">{message}</p>}<Button type="submit" disabled={busy||currentPin.length!==4||newPin.length!==4||confirmPin.length!==4}>{busy?'Salvo…':'Aggiorna PIN'}</Button></form></Card></div>
}

export function ProfileDetailsView({ user, hotel }) {
  const [email,setEmail]=useState(user?.email||''),[phone,setPhone]=useState(user?.phone||''),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
  useEffect(()=>{setEmail(user?.email||'');setPhone(user?.phone||'')},[user])
  const save=async(e)=>{e.preventDefault();setBusy(true);setMessage('');try{await updateOwnProfile({email,phone});setMessage('Profilo aggiornato.')}catch(err){setMessage(err?.message||'Aggiornamento non riuscito')}finally{setBusy(false)}}
  const presence=async(value)=>{setBusy(true);try{await setOwnPresence(value);setMessage(value?'Presenza attivata.':'Presenza disattivata.')}finally{setBusy(false)}}
  return <div data-testid="profile-details-view"><PageTitle title="Dati profilo" subtitle={hotel.name}/><Card className="rs-card--pad"><form className="rs-migrated-form" onSubmit={save}><Field label="Email"><TextInput value={email} type="email" onChange={e=>setEmail(e.target.value)}/></Field><Field label="Telefono"><TextInput value={phone} inputMode="tel" onChange={e=>setPhone(e.target.value)}/></Field><div className="rs-op-card__actions"><Button type="submit" disabled={busy}>Salva</Button><Button type="button" variant="outline" onClick={()=>presence(true)}>Sono in struttura</Button><Button type="button" variant="ghost" onClick={()=>presence(false)}>Fuori struttura</Button></div>{message&&<p className="rs-muted">{message}</p>}</form></Card></div>
}

export function ManualView() {
  return <div data-testid="manual-view"><PageTitle title="Manuale" subtitle="Guida rapida RandApp"/><div className="rs-migrated-list">
    {[['Segnalazioni','Crea una segnalazione con il pulsante +, aggiungi posizione, categoria, descrizione e foto.'],['Interventi','Consulta i lavori assegnati e aggiorna lo stato quando il lavoro è completato.'],['Avvisi urgenti','Gli avvisi urgenti sono sincronizzati in tempo reale e possono essere presi in carico.'],['Planning','Usa Planning lavori e, per Hotel Giò, Planning sale per consultare le attività programmate.'],['Struttura','Tocca il nome dell’hotel nell’intestazione per cambiare struttura quando il tuo account ne gestisce più di una.'],['Aspetto','Tema Sistema/Chiaro/Scuro e dimensione Piccolo/Normale/Grande sono disponibili in Profilo e nel menu.']].map(([title,text])=><Card key={title} className="rs-card--pad rs-manual-card"><strong>{title}</strong><p>{text}</p></Card>)}
  </div></div>
}
