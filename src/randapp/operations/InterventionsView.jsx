import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchPlanned, updatePlannedRow, deletePlannedRow, subscribePlanned } from '../../planned-data.js'
import { fetchInventoryItems } from '../../inventory-data.js'
import {
  consumeInterventionPart,
  fetchAvailableSerialUnits,
  fetchInterventionParts,
  fetchInventoryAvailability,
  releaseInterventionPart,
  requestInterventionPart,
  reserveInterventionPart,
  subscribeInterventionParts,
} from '../../inventory-intervention-data.js'
import { Button, Card, EmptyState, Field, Icon, IconButton, Spinner, TextInput, Sheet, ConfirmDialog, Badge } from '../ui.jsx'
import { canCreatePlanned, compressPhotoAsDataUrl } from '../helpers.js'
import { PageTitle, StatusPill, fmt, isAssignedTo } from './view-primitives.jsx'

const partStatusLabel = { requested: 'Richiesto', reserved: 'Prenotato', consumed: 'Usato', released: 'Rilasciato', cancelled: 'Annullato' }
const partStatusTone = { requested: 'warning', reserved: 'info', consumed: 'success', released: 'default', cancelled: 'default' }
const qty = (value) => Number(value || 0).toLocaleString('it-IT', { maximumFractionDigits: 3 })

export default function InterventionsView({ hotel, user }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('active')
  const [selected, setSelected] = useState(null)
  const load = useCallback(async () => { const result = await fetchPlanned(hotel.id); setItems(result.items || []); setLoading(false) }, [hotel.id])
  useEffect(() => { load(); return subscribePlanned(hotel.id, load) }, [hotel.id, load])
  const visible = useMemo(() => items.filter((item) => filter === 'all' || (filter === 'done' ? item.status === 'done' : item.status !== 'done')), [items, filter])
  const doUpdate = async (id, changes) => { setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...changes } : i))); try { return await updatePlannedRow(id, { ...changes, hotelId: hotel.id }) } finally { await load() } }
  const doDelete = async (id) => { await deletePlannedRow(id, hotel.id); await load() }
  return <div data-testid="interventions-view">
    <PageTitle title="Interventi" subtitle={`${hotel.name} · ${items.filter(i => i.status !== 'done').length} aperti`} />
    <div className="rs-segmented rs-migrated-tabs">{[['active','Aperti'],['done','Fatti'],['all','Tutti']].map(([id,label]) => <button type="button" key={id} className={filter===id?'active':''} onClick={()=>setFilter(id)}>{label}</button>)}</div>
    {loading ? <Spinner label="Carico interventi…" /> : !visible.length ? <EmptyState icon="wrench" title="Nessun intervento">Non ci sono elementi per questo filtro.</EmptyState> : <div className="rs-migrated-list">{visible.map((item) => {const assigned=isAssignedTo(item,user),roomsTotal=Array.isArray(item.rooms)?item.rooms.length:0,roomsDone=Object.keys(item.roomsDone||{}).length;return <Card as="button" key={item.id} className={`rs-card--pad rs-op-card ${assigned?'rs-op-card--assigned':''}`} onClick={()=>setSelected(item)}><div className="rs-op-card__head"><div><strong>{item.location||'Intervento'}</strong><small>{item.category||'Manutenzione'} · {fmt(item.scheduledAt)}</small></div><StatusPill status={item.status}/></div>{item.notes&&<p>{item.notes}</p>}{roomsTotal>0&&<small>{roomsDone}/{roomsTotal} camere completate</small>}{item.pieceReplaced&&<small>Ricambi usati: {item.pieceReplaced}</small>}{!!item.assignees?.length&&<small>Assegnato a: {item.assignees.map(p=>p.name||p).join(', ')}</small>}</Card>})}</div>}
    {selected&&<PlannedDetail item={selected} hotel={hotel} user={user} onClose={()=>setSelected(null)} onUpdate={doUpdate} onDelete={doDelete}/>} 
  </div>
}

function InterventionParts({ item, hotel, editable, onWaitingChange }) {
  const [parts, setParts] = useState([])
  const [items, setItems] = useState([])
  const [availability, setAvailability] = useState([])
  const [serials, setSerials] = useState([])
  const [openAdd, setOpenAdd] = useState(false)
  const [itemId, setItemId] = useState('')
  const [freeName, setFreeName] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [serialId, setSerialId] = useState('')
  const [note, setNote] = useState('')
  const [linkChoice, setLinkChoice] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const [nextParts, nextItems, nextAvailability] = await Promise.all([
      fetchInterventionParts(item.id),
      fetchInventoryItems(hotel.id),
      fetchInventoryAvailability(hotel.id),
    ])
    setParts(nextParts); setItems(nextItems); setAvailability(nextAvailability)
    onWaitingChange?.(nextParts.some((p) => p.status === 'requested' || p.status === 'reserved'))
  }, [item.id, hotel.id, onWaitingChange])

  useEffect(() => { load().catch((e) => setError(e.message)); return subscribeInterventionParts(item.id, () => load().catch(() => {})) }, [item.id, load])
  useEffect(() => {
    setSerialId('')
    if (!itemId) { setSerials([]); return }
    fetchAvailableSerialUnits(itemId).then(setSerials).catch(() => setSerials([]))
  }, [itemId])

  const availabilityById = useMemo(() => new Map(availability.map((row) => [row.itemId, row])), [availability])
  const itemById = useMemo(() => new Map(items.map((row) => [row.id, row])), [items])
  const selectedAvailability = availabilityById.get(itemId)
  const selectedItem = itemById.get(itemId)
  const reservePossible = Boolean(itemId && selectedAvailability && selectedAvailability.availableQuantity >= Number(quantity || 0))

  const add = async () => {
    if (!itemId && !freeName.trim()) return
    setBusy(true); setError('')
    try {
      const reserve = Boolean(itemId && reservePossible)
      await requestInterventionPart(item.id, { itemId: itemId || null, requestedName: freeName, quantity: Number(quantity || 1), note, reserve, serialUnitId: reserve ? serialId || null : null })
      if (!reserve) await onWaitingChange?.(true)
      setOpenAdd(false); setItemId(''); setFreeName(''); setQuantity('1'); setSerialId(''); setNote(''); await load()
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  const reserveExisting = async (part) => {
    const target = linkChoice[part.id] || part.itemId
    if (!target) return
    setBusy(true); setError('')
    try { await reserveInterventionPart(part.id, target); await load() } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  const usePart = async (part) => { setBusy(true); setError(''); try { await consumeInterventionPart(part.id); await load() } catch (e) { setError(e.message) } finally { setBusy(false) } }
  const releasePart = async (part, cancel = false) => { setBusy(true); setError(''); try { await releaseInterventionPart(part.id, { cancel }); await load() } catch (e) { setError(e.message) } finally { setBusy(false) } }

  const active = parts.filter((p) => p.status !== 'cancelled')
  return <section className="rs-intervention-parts" data-testid="intervention-parts">
    <div className="rs-intervention-parts__head"><div><strong>Ricambi e materiali</strong><small>Richieste, prenotazioni e consumi collegati al Magazzino</small></div>{editable&&<Button variant="ghost" size="sm" icon="plus" onClick={()=>setOpenAdd((v)=>!v)}>Aggiungi</Button>}</div>
    {openAdd&&editable&&<Card className="rs-card--pad rs-intervention-part-form">
      <Field label="Articolo di Magazzino"><select className="rs-select" value={itemId} onChange={(e)=>{setItemId(e.target.value);setFreeName('')}}><option value="">Non presente in catalogo</option>{items.map((inventoryItem)=>{const stock=availabilityById.get(inventoryItem.id);return <option key={inventoryItem.id} value={inventoryItem.id}>{inventoryItem.name}{inventoryItem.variantLabel?` · ${inventoryItem.variantLabel}`:''} · disp. {qty(stock?.availableQuantity)} {inventoryItem.unit}</option>})}</select></Field>
      {!itemId&&<Field label="Pezzo richiesto"><TextInput value={freeName} onChange={(e)=>setFreeName(e.target.value)} placeholder="Es. Faretto LED IP65"/></Field>}
      <div className="rs-inventory-form-grid"><Field label="Quantità"><TextInput type="number" min="0.001" step="0.001" value={quantity} onChange={(e)=>setQuantity(e.target.value)}/></Field>{serials.length>0&&Number(quantity)===1?<Field label="Unità serializzata (opzionale)"><select className="rs-select" value={serialId} onChange={(e)=>setSerialId(e.target.value)}><option value="">Nessun seriale</option>{serials.map((s)=><option key={s.id} value={s.id}>{s.assetTag||s.serialNumber}{s.assetTag&&s.serialNumber?` · ${s.serialNumber}`:''}</option>)}</select></Field>:<span/>}</div>
      <Field label="Nota"><TextInput value={note} onChange={(e)=>setNote(e.target.value)} placeholder="Facoltativa"/></Field>
      {itemId&&<p className="rs-field__hint">Giacenza fisica {qty(selectedAvailability?.quantity)} {selectedItem?.unit}; già prenotati {qty(selectedAvailability?.reservedQuantity)}; disponibili {qty(selectedAvailability?.availableQuantity)}.</p>}
      {itemId&&!reservePossible&&<p className="rs-note rs-note--waiting">La quantità non è disponibile: verrà registrata come richiesta senza scaricare né prenotare stock.</p>}
      <div className="rs-form-actions"><Button variant="ghost" onClick={()=>setOpenAdd(false)}>Annulla</Button><Button variant="primary" disabled={busy||(!itemId&&!freeName.trim())||Number(quantity)<=0} onClick={add}>{itemId&&reservePossible?'Prenota ricambio':'Registra richiesta'}</Button></div>
    </Card>}
    {!active.length?<p className="rs-field__hint">Nessun ricambio collegato.</p>:<div className="rs-intervention-parts__list">{active.map((part)=>{const inventoryItem=itemById.get(part.itemId);const label=inventoryItem?.name||part.requestedName||'Ricambio';return <Card key={part.id} className="rs-card--pad rs-intervention-part"><div className="rs-intervention-part__top"><div><strong>{label}</strong><small>{qty(part.quantity)} {inventoryItem?.unit||'pz'}{part.note?` · ${part.note}`:''}</small></div><Badge tone={partStatusTone[part.status]}>{partStatusLabel[part.status]||part.status}</Badge></div>
      {part.status==='requested'&&editable&&<div className="rs-intervention-part__actions">{!part.itemId&&<select className="rs-select" value={linkChoice[part.id]||''} onChange={(e)=>setLinkChoice({...linkChoice,[part.id]:e.target.value})}><option value="">Associa articolo…</option>{items.map((candidate)=><option key={candidate.id} value={candidate.id}>{candidate.name} · disp. {qty(availabilityById.get(candidate.id)?.availableQuantity)}</option>)}</select>}<Button size="sm" variant="primary" disabled={busy||(!part.itemId&&!linkChoice[part.id])} onClick={()=>reserveExisting(part)}>Prenota</Button><Button size="sm" variant="ghost" disabled={busy} onClick={()=>releasePart(part,true)}>Annulla</Button></div>}
      {part.status==='reserved'&&editable&&<div className="rs-intervention-part__actions"><Button size="sm" variant="primary" icon="check" disabled={busy} onClick={()=>usePart(part)}>Usato</Button><Button size="sm" variant="ghost" disabled={busy} onClick={()=>releasePart(part,false)}>Non usato</Button></div>}
      {part.status==='consumed'&&<small className="rs-field__hint">Movimento Magazzino registrato e collegato all’intervento.</small>}
      {part.status==='released'&&editable&&<div className="rs-intervention-part__actions"><Button size="sm" variant="ghost" disabled={busy||!part.itemId} onClick={()=>reserveExisting(part)}>Prenota di nuovo</Button><Button size="sm" variant="ghost" disabled={busy} onClick={()=>releasePart(part,true)}>Chiudi richiesta</Button></div>}
    </Card>})}</div>}
    {error&&<p className="rs-error" role="alert">{error}</p>}
  </section>
}

function PlannedDetail({ item, hotel, user, onClose, onUpdate, onDelete }) {
  const [photo,setPhoto]=useState(null),[confirmDel,setConfirmDel]=useState(false),[partsPending,setPartsPending]=useState(false),[parts,setParts]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false)
  const assigned=isAssignedTo(item,user),canManage=canCreatePlanned(user)||user?.role==='manutentore',canComplete=(canManage||assigned)&&item.status!=='done',rooms=Array.isArray(item.rooms)?item.rooms:null,roomsDone=item.roomsDone||{},doneCount=rooms?rooms.filter(r=>roomsDone[r]).length:0,pct=rooms?.length?Math.round((doneCount/rooms.length)*100):0
  useEffect(()=>{fetchInterventionParts(item.id).then(setParts).catch(()=>setParts([]));return subscribeInterventionParts(item.id,()=>fetchInterventionParts(item.id).then(setParts).catch(()=>{}))},[item.id])
  const consumedParts=parts.filter((part)=>part.status==='consumed')
  const toggleRoom=async(room)=>{if(!canComplete)return;const next={...roomsDone};if(next[room])delete next[room];else next[room]={by:user?.name,at:Date.now()};await onUpdate(item.id,{roomsDone:next})}
  const complete=async()=>{setBusy(true);setError('');try{await onUpdate(item.id,{status:'done',photoAfter:photo,completedBy:user?.name,completedAt:Date.now()});onClose()}catch(e){setError(e.message)}finally{setBusy(false)}}
  const remove=async()=>{setBusy(true);setError('');try{const current=await fetchInterventionParts(item.id);if(current.some((part)=>part.status==='consumed'))throw new Error('Questo intervento ha movimenti Magazzino: non può essere eliminato senza perdere la tracciabilità.');for(const part of current.filter((p)=>p.status==='requested'||p.status==='reserved'||p.status==='released'))await releaseInterventionPart(part.id,{cancel:true});await onDelete(item.id);onClose()}catch(e){setConfirmDel(false);setError(e.message)}finally{setBusy(false)}}
  return <Sheet open onClose={onClose} className="rs-issue-detail">
    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}><StatusPill status={item.status}/>{canManage&&<IconButton icon="trash" label="Elimina" style={{marginLeft:'auto'}} disabled={consumedParts.length>0} onClick={()=>setConfirmDel(true)}/>}</div>
    <h2 className="rs-detail-room">{item.location||'Intervento'}</h2>{item.notes&&<p className="rs-detail-desc">{item.notes}</p>}<p className="rs-detail-origin">{item.category||'Manutenzione'}{item.scheduledAt?` · ${fmt(item.scheduledAt)}`:''}</p>{!!item.assignees?.length&&<p className="rs-detail-origin">Assegnato a: {item.assignees.map(p=>p.name||p).join(', ')}</p>}
    {rooms?.length>0&&<div className="rs-note"><p style={{margin:'0 0 8px',fontWeight:700}}>{doneCount}/{rooms.length} camere completate ({pct}%)</p><div className="rs-chips">{rooms.map(room=><button type="button" key={room} className={`rs-chip ${roomsDone[room]?'active':''}`} disabled={!canComplete} onClick={()=>toggleRoom(room)}>{room}</button>)}</div></div>}
    {item.status==='done'&&<div className="rs-note rs-note--done">Completato da <strong>{item.completedBy}</strong>{item.pieceReplaced&&<><br/>Ricambi: <strong>{item.pieceReplaced}</strong></>}{(item.photoAfter||item.photoAfterPath)&&<img className="rs-photo-preview" src={item.photoAfter||item.photoAfterPath} alt="Foto completamento" style={{marginTop:8}}/>}</div>}
    <InterventionParts item={item} hotel={hotel} editable={canComplete||canManage} onWaitingChange={setPartsPending}/>
    {canComplete&&<div className="rs-actions-stack"><p className="rs-actions-heading">Completamento</p><label className="rs-photo-action" style={{borderStyle:'dashed'}}><input type="file" accept="image/*" onChange={async e=>setPhoto(await compressPhotoAsDataUrl(e.target.files?.[0]))}/><Icon name="camera"/><strong>{photo?'Foto aggiunta':'Aggiungi foto completamento'}</strong></label>{photo&&<img className="rs-photo-preview" src={photo} alt="Anteprima"/>}{partsPending&&<p className="rs-note rs-note--waiting">Risolvi prima i ricambi richiesti o prenotati: segnali come “Usato” oppure “Non usato/Annulla”.</p>}<Button variant="primary" icon="check" disabled={partsPending||busy} onClick={complete}>Segna completato</Button></div>}
    {consumedParts.length>0&&canManage&&<p className="rs-field__hint">L’intervento non è eliminabile perché contiene movimenti Magazzino storici.</p>}
    {error&&<p className="rs-error" role="alert">{error}</p>}
    <ConfirmDialog open={confirmDel} title="Eliminare l'intervento?" message="Le richieste/prenotazioni aperte verranno annullate. Gli interventi con ricambi già consumati restano storici e non sono eliminabili." confirmLabel="Elimina" danger onCancel={()=>setConfirmDel(false)} onConfirm={remove}/>
  </Sheet>
}
