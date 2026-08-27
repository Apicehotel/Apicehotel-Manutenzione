import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { HOTEL_LOCATIONS } from '../locations.js'
import { hotelGioClient } from '../hotelgio-data.js'
import { fetchIssues, insertIssue, updateIssueRow, deleteIssueRow, subscribeIssues } from '../issues-data.js'
import { Button, Card, Field, TextInput, Icon, IconButton, Badge, Segmented, Spinner, EmptyState, Sheet, ConfirmDialog } from './ui.jsx'
import { can, ISSUE_CATEGORIES, ROOM_STATUS_OPTIONS, ISSUE_STATUS_META, URGENCY_META, compressPhotoAsDataUrl } from './helpers.js'

function LocationAutocomplete({ catalog, mode, onModeChange, value, onChange, error }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const rooms = useMemo(() => catalog.roomGroups.flatMap((g) => g.rooms), [catalog])
  const query = value.trim().toLowerCase()
  const suggestions = query
    ? (mode === 'camera'
      ? rooms.filter((r) => r.toLowerCase().startsWith(query))
      : catalog.zones.filter((z) => [z.name, ...z.aliases].some((i) => i.toLowerCase().includes(query))).map((z) => z.name)).slice(0, 8)
    : []
  useEffect(() => {
    const close = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [])
  const changeMode = (next) => { onModeChange(next); onChange(''); setOpen(false) }
  return (
    <div className="rs-autocomplete" ref={wrapRef}>
      <div className="rs-segmented" style={{ marginBottom: 8 }}>
        {[['camera', 'Camera'], ['zona', 'Zona']].map(([k, l]) => (
          <button type="button" key={k} className={mode === k ? 'active' : ''} onClick={() => changeMode(k)}>{l}</button>
        ))}
      </div>
      <TextInput icon="search" value={value} inputMode={mode === 'camera' ? 'numeric' : 'text'} autoComplete="off"
        data-testid="issue-location-input"
        placeholder={mode === 'camera' ? 'Numero camera, es. 214' : 'Cerca zona, es. Hall'}
        onFocus={() => setOpen(Boolean(query))}
        onChange={(e) => { const next = mode === 'camera' ? e.target.value.replace(/[^0-9]/g, '') : e.target.value; onChange(next); setOpen(Boolean(next.trim())) }} />
      {open && suggestions.length > 0 && (
        <div className="rs-suggest" data-testid="issue-location-suggestions">
          {suggestions.map((item) => (
            <button type="button" key={item} onPointerDown={(e) => { e.preventDefault(); onChange(item); setOpen(false) }}><b>{item}</b></button>
          ))}
        </div>
      )}
      {error && <small className="rs-field__error">{error}</small>}
    </div>
  )
}

const NewIssueForm = memo(function NewIssueForm({ hotel, user, onCancel, onSaved }) {
  const catalog = HOTEL_LOCATIONS[hotel.id]
  const photoInputRef = useRef(null)
  const [mode, setMode] = useState('camera')
  const [draft, setDraft] = useState({ location: '', title: '', urgency: 'media', category: 'Varie', photoName: '', photoData: null, roomStatus: null })
  const [saving, setSaving] = useState(false)
  const [roomStatusSuggested, setRoomStatusSuggested] = useState(false)
  const validLocation = mode === 'camera'
    ? catalog.roomGroups.some((g) => g.rooms.includes(draft.location.trim()))
    : catalog.zones.some((z) => z.name === draft.location.trim())
  const pickPhoto = async (file) => { const photoData = await compressPhotoAsDataUrl(file); setDraft((c) => ({ ...c, photoName: file?.name || '', photoData })) }

  // Suggerimento automatico dello Stato camera in base all'housekeeping di oggi
  // (tabella camere_giorno / Slope): non forza nulla, resta sempre modificabile a mano.
  useEffect(() => {
    const room = draft.location.trim()
    if (mode !== 'camera' || !room) return
    let cancelled = false
    hotelGioClient.from('camere_giorno').select('stato_slope').eq('hotel_id', hotel.id).eq('camera', room).maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return
        const mappa = { libera: 'libera', arrivo: 'in_arrivo', partenza: 'fermata_cliente', fermata: 'fermata_cliente', b2b: 'fermata_cliente' }
        const suggerito = mappa[data.stato_slope]
        if (suggerito) { setDraft((c) => ({ ...c, roomStatus: suggerito })); setRoomStatusSuggested(true) }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [mode, draft.location, hotel.id])

  const submit = async (e) => {
    e.preventDefault()
    if (!validLocation || !draft.title.trim() || saving) return
    setSaving(true)
    const issue = {
      hotelId: hotel.id,
      urgency: draft.urgency,
      room: (mode === 'camera' ? 'Camera' : 'Zona') + ' · ' + draft.location.trim(),
      title: draft.title.trim(),
      status: 'todo',
      createdAt: Date.now(),
      createdByName: user?.name || 'App',
      department: user?.department || user?.role || null,
      category: draft.category,
      origin: 'App',
      photoData: draft.photoData,
      roomStatus: mode === 'camera' ? draft.roomStatus : null,
    }
    try { await insertIssue(issue); onSaved() }
    catch (err) { console.warn(err); setSaving(false) }
  }

  return (
    <form className="rs-form" onSubmit={submit} data-testid="new-issue-form">
      <div className="rs-form__head">
        <IconButton icon="chevronLeft" label="Indietro" onClick={onCancel} />
        <div><h2>Nuova segnalazione</h2><p>{hotel.name} · stato iniziale Da fare</p></div>
      </div>
      <Field label="Camera o zona">
        <LocationAutocomplete catalog={catalog} mode={mode} onModeChange={setMode} value={draft.location} onChange={(location) => setDraft({ ...draft, location })}
          error={draft.location && !validLocation ? (mode === 'camera' ? 'Camera non presente nella struttura.' : 'Scegli una zona riconosciuta.') : ''} />
      </Field>
      {mode === 'camera' && (
        <fieldset className="rs-fieldset">
          <legend>Stato camera (opzionale)</legend>
          {roomStatusSuggested && <small className="rs-suggested-hint">🏠 Suggerito da Housekeeping (oggi) — puoi cambiarlo</small>}
          <div className="rs-chips">
            {ROOM_STATUS_OPTIONS.map(([k, l]) => (
              <button type="button" key={k} className={`rs-chip ${draft.roomStatus === k ? 'active' : ''}`} onClick={() => { setRoomStatusSuggested(false); setDraft({ ...draft, roomStatus: draft.roomStatus === k ? null : k }) }}>{l}</button>
            ))}
          </div>
        </fieldset>
      )}
      <fieldset className="rs-fieldset">
        <legend>Urgenza</legend>
        <div className="rs-chips">
          {[['alta', 'Alta', 'high'], ['media', 'Media', 'mid'], ['bassa', 'Bassa', 'low']].map(([k, l, t]) => (
            <button type="button" key={k} className={`rs-chip ${draft.urgency === k ? `active ${t}` : ''}`} onClick={() => setDraft({ ...draft, urgency: k })} data-testid={`urgency-${k}`}>{l}</button>
          ))}
        </div>
      </fieldset>
      <fieldset className="rs-fieldset">
        <legend>Categoria</legend>
        <div className="rs-chips">
          {ISSUE_CATEGORIES.map((item) => (
            <button type="button" key={item} className={`rs-chip ${draft.category === item ? 'active' : ''}`} onClick={() => setDraft({ ...draft, category: item })}>{item}</button>
          ))}
        </div>
      </fieldset>
      <Field label="Descrizione del problema">
        <textarea className="rs-textarea" required rows="4" value={draft.title} placeholder="Descrivi il problema in modo chiaro" data-testid="issue-title-input"
          onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
      </Field>
      <fieldset className="rs-fieldset">
        <legend>Foto (opzionale)</legend>
        <div className="rs-photo-actions">
          <input ref={photoInputRef} type="file" accept="image/*" hidden onChange={(e) => pickPhoto(e.target.files?.[0])} />
          <button type="button" className="rs-photo-action" onClick={() => photoInputRef.current?.click()}><Icon name="camera" /><strong>Foto</strong></button>
        </div>
      </fieldset>
      {draft.photoData && (
        <div className="rs-photo-preview-wrap rs-photo-preview-wrap--full">
          <img className="rs-photo-preview" src={draft.photoData} alt="Anteprima" />
          <button type="button" className="rs-photo-remove" aria-label="Rimuovi foto" onClick={() => setDraft((c) => ({ ...c, photoData: null, photoName: '' }))}><Icon name="close" /></button>
        </div>
      )}
      <div className="rs-form-actions">
        <Button type="button" variant="ghost" onClick={onCancel}>Annulla</Button>
        <Button variant="primary" icon="plus" disabled={!validLocation || !draft.title.trim() || saving} data-testid="submit-issue">{saving ? 'Invio…' : 'Invia segnalazione'}</Button>
      </div>
    </form>
  )
})

function IssuePhoto({ src, alt }) {
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState(false)
  useEffect(() => { setFailed(false); setOpen(false) }, [src])
  useEffect(() => {
    if (!open) return undefined
    const close = (event) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', close)
    return () => document.removeEventListener('keydown', close)
  }, [open])
  if (!src || failed) return <div className="rs-photo-unavailable"><Icon name="image" /><span>Foto non disponibile</span></div>
  return <>
    <button type="button" className="rs-detail-photo-button" onClick={() => setOpen(true)} aria-label={`Ingrandisci ${alt}`}>
      <img className="rs-detail-photo" src={src} alt={alt} onError={() => setFailed(true)} />
      <span className="rs-detail-photo-hint">Tocca per ingrandire</span>
    </button>
    {open && <div className="rs-photo-lightbox" role="dialog" aria-modal="true" aria-label={alt} onClick={() => setOpen(false)}>
      <button type="button" className="rs-photo-lightbox__close" onClick={() => setOpen(false)} aria-label="Chiudi foto">×</button>
      <img src={src} alt={alt} onError={() => { setFailed(true); setOpen(false) }} onClick={(event) => event.stopPropagation()} />
    </div>}
  </>
}

function IssueDetail({ issue, user, users, onClose, onUpdate, onDelete }) {
  const [note, setNote] = useState('')
  const [photo, setPhoto] = useState(null)
  const [piece, setPiece] = useState('')
  const [replaced, setReplaced] = useState('')
  const [asking, setAsking] = useState('')
  const [techChoice, setTechChoice] = useState('')
  const [confirmDel, setConfirmDel] = useState(false)
  const canComplete = can(user, 'complete') || can(user, 'take_charge')
  const canAssign = can(user, 'assign')
  const technicians = (users || []).filter((p) => p.role === 'Tecnico esterno')
  const meta = ISSUE_STATUS_META[issue.status] || {}

  const complete = () => { onUpdate(issue.id, { status: 'done', completionNote: note.trim() || null, completionPhotoData: photo, completedBy: user?.name, completedAt: Date.now() }); onClose() }
  const confirmPiece = () => { if (!piece.trim()) return; onUpdate(issue.id, { status: 'waiting', pieceName: piece.trim() }); onClose() }
  const confirmReplaced = () => { if (!replaced.trim()) return; onUpdate(issue.id, { pieceReplaced: replaced.trim(), pieceReplacedBy: user?.name }); setAsking(''); setReplaced('') }
  const confirmTech = () => { const t = technicians.find((p) => p.id === techChoice); if (!t) return; onUpdate(issue.id, { status: 'tecnico', technicianRequestedBy: user?.name, technicianId: t.id, technicianName: t.name, technicianPhone: t.phone || null }); onClose() }
  const pieceArrived = () => { onUpdate(issue.id, { status: 'todo' }); onClose() }
  const techDone = () => { onUpdate(issue.id, { status: 'done', completedBy: user?.name, completedAt: Date.now() }); onClose() }

  return (
    <Sheet open onClose={onClose} className="rs-issue-detail">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Badge tone={URGENCY_META[issue.urgency]?.tone}>{URGENCY_META[issue.urgency]?.label || issue.urgency}</Badge>
        <Badge tone={meta.tone}>{meta.label}</Badge>
        {canAssign && <IconButton icon="trash" label="Elimina" style={{ marginLeft: 'auto' }} onClick={() => setConfirmDel(true)} data-testid="delete-issue" />}
      </div>
      <h2 className="rs-detail-room">{issue.room}</h2>
      <p className="rs-detail-desc">{issue.title}</p>
      <p className="rs-detail-origin">Da {issue.origin || 'App'}{issue.createdByName ? ` · ${issue.createdByName}` : ''} · {issue.date}</p>
      <dl className="rs-meta-grid">
        <div><dt>Reparto</dt><dd>{issue.department || '—'}</dd></div>
        <div><dt>Categoria</dt><dd>{issue.category || '—'}</dd></div>
        {issue.roomStatus && <div><dt>Stato camera</dt><dd>{ROOM_STATUS_OPTIONS.find(([k]) => k === issue.roomStatus)?.[1] || issue.roomStatus}</dd></div>}
      </dl>
      {(issue.photoData || issue.photoPath) && <IssuePhoto src={issue.photoData} alt="Foto segnalazione" />}

      {issue.status === 'tecnico' && <div className="rs-note rs-note--tecnico">Tecnico richiesto da <strong>{issue.technicianRequestedBy}</strong>{issue.technicianName && <> · assegnato a <strong>{issue.technicianName}</strong></>}</div>}
      {issue.status === 'waiting' && <div className="rs-note rs-note--waiting">In attesa del pezzo: <strong>{issue.pieceName}</strong></div>}
      {issue.pieceReplaced && <div className="rs-note">Pezzo sostituito: <strong>{issue.pieceReplaced}</strong>{issue.pieceReplacedBy && <> · {issue.pieceReplacedBy}</>}</div>}
      {issue.status === 'done' && <div className="rs-note rs-note--done">Completata da <strong>{issue.completedBy}</strong>{issue.completionNote && <p style={{ margin: '6px 0 0' }}>{issue.completionNote}</p>}{(issue.completionPhotoData || issue.completionPhotoPath) && <IssuePhoto src={issue.completionPhotoData} alt="Foto riparazione" />}</div>}

      {issue.status === 'todo' && canComplete && !asking && (
        <div className="rs-actions-stack">
          <p className="rs-actions-heading">Azioni</p>
          <div className="rs-action-pair">
            <Button variant="ghost" icon="package" onClick={() => setAsking('piece')} data-testid="action-piece">Serve pezzo</Button>
            {!issue.pieceReplaced && <Button variant="ghost" icon="package" onClick={() => setAsking('replaced')}>Pezzo sostituito</Button>}
          </div>
          <Button variant="ghost" icon="message" onClick={() => setAsking('tech')}>Chiedi un tecnico</Button>
          <Field label="Note sul lavoro fatto (facoltative)">
            <textarea className="rs-textarea" rows="3" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Cosa è stato fatto" data-testid="completion-note" />
          </Field>
          <label className="rs-photo-action" style={{ borderStyle: 'dashed' }}>
            <input type="file" accept="image/*" onChange={async (e) => setPhoto(await compressPhotoAsDataUrl(e.target.files?.[0]))} />
            <Icon name="camera" /><strong>{photo ? 'Foto aggiunta' : 'Aggiungi foto completamento'}</strong>
          </label>
          {photo && <img className="rs-photo-preview" src={photo} alt="Anteprima" />}
          <Button variant="primary" icon="check" onClick={complete} data-testid="complete-issue">Riparazione completata</Button>
        </div>
      )}
      {issue.status === 'waiting' && canComplete && <div className="rs-actions-stack"><Button variant="primary" onClick={pieceArrived}>Pezzo arrivato, torna in Da fare</Button></div>}
      {issue.status === 'tecnico' && canComplete && <div className="rs-actions-stack"><Button variant="primary" icon="check" onClick={techDone}>Segna completata (tecnico)</Button></div>}

      {asking === 'piece' && (
        <div className="rs-actions-stack">
          <Field label="Nome del pezzo in attesa"><TextInput value={piece} onChange={(e) => setPiece(e.target.value)} placeholder="Es. Faretto LED IP65" /></Field>
          <div className="rs-form-actions"><Button variant="ghost" onClick={() => setAsking('')}>Annulla</Button><Button variant="primary" disabled={!piece.trim()} onClick={confirmPiece}>Conferma</Button></div>
        </div>
      )}
      {asking === 'replaced' && (
        <div className="rs-actions-stack">
          <Field label="Cosa hai sostituito"><TextInput value={replaced} onChange={(e) => setReplaced(e.target.value)} placeholder="Es. Lampadina LED bagno" /></Field>
          <div className="rs-form-actions"><Button variant="ghost" onClick={() => setAsking('')}>Annulla</Button><Button variant="primary" disabled={!replaced.trim()} onClick={confirmReplaced}>Registra</Button></div>
        </div>
      )}
      {asking === 'tech' && (
        <div className="rs-actions-stack">
          <Field label="Quale tecnico esterno?">
            <select className="rs-select" value={techChoice} onChange={(e) => setTechChoice(e.target.value)}>
              <option value="">Scegli…</option>
              {technicians.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
          {!technicians.length && <p className="rs-field__hint">Nessun tecnico esterno configurato per questa struttura.</p>}
          <div className="rs-form-actions"><Button variant="ghost" onClick={() => setAsking('')}>Annulla</Button><Button variant="primary" disabled={!techChoice} onClick={confirmTech}>Conferma richiesta</Button></div>
        </div>
      )}

      <ConfirmDialog open={confirmDel} title="Eliminare la segnalazione?" message="L'azione non è reversibile." confirmLabel="Elimina" danger
        onCancel={() => setConfirmDel(false)} onConfirm={() => { onDelete(issue.id); setConfirmDel(false); onClose() }} />
    </Sheet>
  )
}

const FILTERS = [
  ['todo', 'Da fare'],
  ['tecnico', 'Tecnico'],
  ['waiting', 'Attesa pezzo'],
  ['done', 'Completate'],
  ['all', 'Tutte'],
]

export default function Issues({ user, hotel, users, createSignal }) {
  const [loading, setLoading] = useState(true)
  const [issues, setIssues] = useState([])
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [selected, setSelected] = useState(null)

  useEffect(() => { if (createSignal && can(user, 'create')) setCreating(true) }, [createSignal])

  const reload = () => fetchIssues(hotel.id).then(({ issues: list }) => setIssues(list || [])).catch(() => {}).finally(() => setLoading(false))

  useEffect(() => {
    setLoading(true)
    reload()
    const unsub = subscribeIssues(hotel.id, () => reload())
    return () => unsub?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotel.id])

  const counts = useMemo(() => issues.reduce((acc, i) => ({ ...acc, [i.status]: (acc[i.status] || 0) + 1 }), {}), [issues])
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return issues
      .filter((i) => filter === 'all' || i.status === filter)
      .filter((i) => !q || `${i.room} ${i.title} ${i.category}`.toLowerCase().includes(q))
  }, [issues, filter, search])

  const doUpdate = async (id, changes) => {
    // Aggiornamento ottimistico: la lista mostra subito il nuovo stato (es. "Completata")
    // senza aspettare l'upload della foto + il round-trip di rete, che restano comunque
    // in corso in background e si riconciliano con reload() alla fine.
    setIssues((prev) => prev.map((i) => (i.id === id ? { ...i, ...changes } : i)))
    try { await updateIssueRow(id, { ...changes, hotelId: hotel.id }) } finally { reload() }
  }
  const doDelete = async (id) => { await deleteIssueRow(id, hotel.id); reload() }

  if (creating) return <NewIssueForm hotel={hotel} user={user} onCancel={() => setCreating(false)} onSaved={() => { setCreating(false); reload() }} />

  return (
    <div data-testid="issues-view">
      <div className="rs-page-title">
        <div><h1>Segnalazioni</h1><p>{hotel.name}</p></div>
        {can(user, 'create') && <Button variant="primary" icon="plus" onClick={() => setCreating(true)} data-testid="open-new-issue">Nuova</Button>}
      </div>
      <div className="rs-toolbar">
        <TextInput icon="search" value={search} placeholder="Cerca camera, problema, categoria…" data-testid="issue-search"
          onChange={(e) => setSearch(e.target.value)} />
        <div className="rs-issue-filter-scroll" data-testid="issue-filters">
          <Segmented value={filter} onChange={setFilter}
            options={FILTERS.map(([k, l]) => [k, l, k === 'all' ? issues.length : (counts[k] || 0)])} />
        </div>
      </div>

      {loading ? <Spinner label="Carico le segnalazioni…" /> : filtered.length === 0 ? (
        <EmptyState icon="issues" title="Nessuna segnalazione">
          {filter === 'all' ? `Non ci sono ancora segnalazioni per ${hotel.name}.` : 'Nessuna segnalazione con questo filtro.'}
        </EmptyState>
      ) : (
        <div className="rs-list rs-list--grid" data-testid="issues-list">
          {filtered.map((issue) => (
            <Card as="button" key={issue.id} className="rs-issue" onClick={() => setSelected(issue)} data-testid={`issue-${issue.id}`}>
              <span className={`rs-issue__accent ${URGENCY_META[issue.urgency]?.tone || 'mid'}`} />
              <span className="rs-issue__main">
                <span className="rs-issue__top">
                  <span className="rs-issue__room">{issue.room}</span>
                  <Badge tone={ISSUE_STATUS_META[issue.status]?.tone}>{ISSUE_STATUS_META[issue.status]?.label || issue.status}</Badge>
                </span>
                <span className="rs-issue__title">{issue.title}</span>
                <span className="rs-issue__meta"><span><Icon name="clock" /> {issue.date}</span>{issue.category && <span>· {issue.category}</span>}</span>
              </span>
              {issue.photoData && <img className="rs-issue__photo" src={issue.photoData} alt="" />}
            </Card>
          ))}
        </div>
      )}

      {selected && <IssueDetail issue={selected} user={user} users={users} onClose={() => setSelected(null)} onUpdate={doUpdate} onDelete={doDelete} />}
    </div>
  )
}
