import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchPlanned, updatePlannedRow, deletePlannedRow, subscribePlanned } from '../../planned-data.js'
import { Button, Card, EmptyState, Field, Icon, IconButton, Spinner, TextInput, Sheet, ConfirmDialog } from '../ui.jsx'
import { canCreatePlanned, compressPhotoAsDataUrl } from '../helpers.js'
import { PageTitle, StatusPill, fmt, isAssignedTo } from './view-primitives.jsx'

export default function InterventionsView({ hotel, user }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('active')
  const [selected, setSelected] = useState(null)
  const load = useCallback(async () => { const result = await fetchPlanned(hotel.id); setItems(result.items || []); setLoading(false) }, [hotel.id])
  useEffect(() => { load(); return subscribePlanned(hotel.id, load) }, [hotel.id, load])
  const visible = useMemo(() => items.filter((item) => filter === 'all' || (filter === 'done' ? item.status === 'done' : item.status !== 'done')), [items, filter])
  const doUpdate = async (id, changes) => { setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...changes } : i))); try { await updatePlannedRow(id, { ...changes, hotelId: hotel.id }) } finally { load() } }
  const doDelete = async (id) => { await deletePlannedRow(id, hotel.id); load() }
  return <div data-testid="interventions-view">
    <PageTitle title="Interventi" subtitle={`${hotel.name} · ${items.filter(i => i.status !== 'done').length} aperti`} />
    <div className="rs-segmented rs-migrated-tabs">{[['active','Aperti'],['done','Fatti'],['all','Tutti']].map(([id,label]) => <button type="button" key={id} className={filter===id?'active':''} onClick={()=>setFilter(id)}>{label}</button>)}</div>
    {loading ? <Spinner label="Carico interventi…" /> : !visible.length ? <EmptyState icon="wrench" title="Nessun intervento">Non ci sono elementi per questo filtro.</EmptyState> : <div className="rs-migrated-list">{visible.map((item) => {const assigned=isAssignedTo(item,user),roomsTotal=Array.isArray(item.rooms)?item.rooms.length:0,roomsDone=Object.keys(item.roomsDone||{}).length;return <Card as="button" key={item.id} className={`rs-card--pad rs-op-card ${assigned?'rs-op-card--assigned':''}`} onClick={()=>setSelected(item)}><div className="rs-op-card__head"><div><strong>{item.location||'Intervento'}</strong><small>{item.category||'Manutenzione'} · {fmt(item.scheduledAt)}</small></div><StatusPill status={item.status}/></div>{item.notes&&<p>{item.notes}</p>}{roomsTotal>0&&<small>{roomsDone}/{roomsTotal} camere completate</small>}{!!item.assignees?.length&&<small>Assegnato a: {item.assignees.map(p=>p.name||p).join(', ')}</small>}</Card>})}</div>}
    {selected&&<PlannedDetail item={selected} user={user} onClose={()=>setSelected(null)} onUpdate={doUpdate} onDelete={doDelete}/>} 
  </div>
}

function PlannedDetail({ item, user, onClose, onUpdate, onDelete }) {
  const [piece,setPiece]=useState(''),[asking,setAsking]=useState(''),[photo,setPhoto]=useState(null),[confirmDel,setConfirmDel]=useState(false)
  const assigned=isAssignedTo(item,user),canManage=canCreatePlanned(user)||user?.role==='manutentore',canComplete=(canManage||assigned)&&item.status!=='done'&&item.status!=='waiting',rooms=Array.isArray(item.rooms)?item.rooms:null,roomsDone=item.roomsDone||{},doneCount=rooms?rooms.filter(r=>roomsDone[r]).length:0,pct=rooms?.length?Math.round((doneCount/rooms.length)*100):0
  const toggleRoom=(room)=>{if(!canComplete)return;const next={...roomsDone};if(next[room])delete next[room];else next[room]={by:user?.name,at:Date.now()};onUpdate(item.id,{roomsDone:next})}
  const complete=()=>{onUpdate(item.id,{status:'done',photoAfter:photo,completedBy:user?.name,completedAt:Date.now()});onClose()}
  const confirmPiece=()=>{if(!piece.trim())return;onUpdate(item.id,{status:'waiting',pieceName:piece.trim()});onClose()}
  const pieceArrived=()=>{onUpdate(item.id,{status:'pending'});onClose()}
  return <Sheet open onClose={onClose} className="rs-issue-detail">
    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}><StatusPill status={item.status}/>{canManage&&<IconButton icon="trash" label="Elimina" style={{marginLeft:'auto'}} onClick={()=>setConfirmDel(true)}/>}</div>
    <h2 className="rs-detail-room">{item.location||'Intervento'}</h2>{item.notes&&<p className="rs-detail-desc">{item.notes}</p>}<p className="rs-detail-origin">{item.category||'Manutenzione'}{item.scheduledAt?` · ${fmt(item.scheduledAt)}`:''}</p>{!!item.assignees?.length&&<p className="rs-detail-origin">Assegnato a: {item.assignees.map(p=>p.name||p).join(', ')}</p>}
    {rooms?.length>0&&<div className="rs-note"><p style={{margin:'0 0 8px',fontWeight:700}}>{doneCount}/{rooms.length} camere completate ({pct}%)</p><div className="rs-chips">{rooms.map(room=><button type="button" key={room} className={`rs-chip ${roomsDone[room]?'active':''}`} disabled={!canComplete} onClick={()=>toggleRoom(room)}>{room}</button>)}</div></div>}
    {item.status==='waiting'&&<div className="rs-note rs-note--waiting">In attesa del pezzo: <strong>{item.pieceName}</strong></div>}{item.status==='done'&&<div className="rs-note rs-note--done">Completato da <strong>{item.completedBy}</strong>{(item.photoAfter||item.photoAfterPath)&&<img className="rs-photo-preview" src={item.photoAfter||item.photoAfterPath} alt="Foto completamento" style={{marginTop:8}}/>}</div>}
    {canComplete&&!asking&&<div className="rs-actions-stack"><p className="rs-actions-heading">Azioni</p><Button variant="ghost" icon="package" onClick={()=>setAsking('piece')}>Serve pezzo</Button><label className="rs-photo-action" style={{borderStyle:'dashed'}}><input type="file" accept="image/*" onChange={async e=>setPhoto(await compressPhotoAsDataUrl(e.target.files?.[0]))}/><Icon name="camera"/><strong>{photo?'Foto aggiunta':'Aggiungi foto completamento'}</strong></label>{photo&&<img className="rs-photo-preview" src={photo} alt="Anteprima"/>}<Button variant="primary" icon="check" onClick={complete}>Segna completato</Button></div>}
    {item.status==='waiting'&&canManage&&<div className="rs-actions-stack"><Button variant="primary" onClick={pieceArrived}>Pezzo arrivato, torna Da fare</Button></div>}
    {asking==='piece'&&<div className="rs-actions-stack"><Field label="Nome del pezzo in attesa"><TextInput value={piece} onChange={e=>setPiece(e.target.value)} placeholder="Es. Faretto LED IP65"/></Field><div className="rs-form-actions"><Button variant="ghost" onClick={()=>setAsking('')}>Annulla</Button><Button variant="primary" disabled={!piece.trim()} onClick={confirmPiece}>Conferma</Button></div></div>}
    <ConfirmDialog open={confirmDel} title="Eliminare l'intervento?" message="L'azione non è reversibile." confirmLabel="Elimina" danger onCancel={()=>setConfirmDel(false)} onConfirm={()=>{onDelete(item.id);setConfirmDel(false);onClose()}}/>
  </Sheet>
}
