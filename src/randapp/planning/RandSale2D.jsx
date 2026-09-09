import { useEffect, useRef, useState } from 'react'
import { fetchSaleLayoutHistory, fetchSaleLayoutSnapshot, restoreSaleLayoutSnapshot, saveSaleLayoutSnapshot } from '../../randsale2d-data.js'
import { RANDSALE2D_TYPES, addLayoutItem, bindLayoutDocument, createLayoutDocument, normalizeLayoutDocument, removeLayoutItem, snapValue, summarizeLayout, updateLayoutItem } from '../../randsale2d-model.js'
import { Button, IconButton, Sheet } from '../ui.jsx'
import { canManageSalePlanning } from './sale-utils.js'

const MAX_HISTORY = 30
const percent = value => `${value}%`
const formatHistoryDate = value => value ? new Intl.DateTimeFormat('it-IT', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—'

function LayoutCanvas({ document, selectedId, onSelect, onMove, onMoveEnd, readonly, zoom }) {
  const pointer = useRef(null), doc = normalizeLayoutDocument(document), scaleX = 100 / doc.room.width, scaleY = 100 / doc.room.height
  void scaleX; void scaleY
  const start = (event, item) => { if (readonly) return; event.currentTarget.setPointerCapture(event.pointerId); pointer.current = { id: item.id, x: event.clientX, y: event.clientY, ox: item.x, oy: item.y }; onSelect(item.id) }
  const move = event => { const active = pointer.current; if (!active || readonly) return; const rect = event.currentTarget.ownerSVGElement.getBoundingClientRect(); onMove(active.id, { x: snapValue(active.ox + (event.clientX - active.x) * doc.room.width / rect.width, doc.grid), y: snapValue(active.oy + (event.clientY - active.y) * doc.room.height / rect.height, doc.grid) }) }
  const end = () => { if (pointer.current) onMoveEnd?.(); pointer.current=null }
  return <div className="rs-sale2d-canvas-scroll"><svg className="rs-sale2d-canvas" style={{width:percent(zoom*100)}} viewBox={`0 0 ${doc.room.width} ${doc.room.height}`} role="img" aria-label={`Pianta ${doc.roomName || 'sala'}`}>
    <defs><pattern id="sale2d-grid" width={doc.grid} height={doc.grid} patternUnits="userSpaceOnUse"><path d={`M ${doc.grid} 0 L 0 0 0 ${doc.grid}`} fill="none" stroke="currentColor" strokeOpacity=".13" strokeWidth="2"/></pattern></defs>
    <rect width="100%" height="100%" rx="18" className="rs-sale2d-room"/><rect width="100%" height="100%" rx="18" fill="url(#sale2d-grid)"/>
    {doc.items.map(item => <g key={item.id} transform={`rotate(${item.rotation} ${item.x+item.width/2} ${item.y+item.height/2})`} className={selectedId===item.id?'selected':''} onPointerDown={event=>start(event,item)} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onClick={()=>onSelect(item.id)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onSelect(item.id)}}} role="button" tabIndex="0" aria-label={item.label}>
      <rect x={item.x} y={item.y} width={item.width} height={item.height} rx="18" fill={RANDSALE2D_TYPES[item.type].color}/><text x={item.x+item.width/2} y={item.y+item.height/2} textAnchor="middle" dominantBaseline="middle">{item.label}</text>
    </g>)}
  </svg></div>
}

function Viewer({ booking, snapshot }) {
  const doc=snapshot?.document, summary=doc?summarizeLayout(doc):[]
  return <div className="rs-sale2d-viewer"><div className="rs-sale2d-readonly"><span>Modalità facchini · sola lettura</span><strong>{booking.room} · {booking.layout || 'Allestimento'}</strong><small>{booking.pax || '—'} PAX · versione {snapshot?.version || 0}</small></div>{doc?<LayoutCanvas document={doc} readonly zoom={1} selectedId={null} onSelect={()=>{}} onMove={()=>{}}/>:<p className="rs-sale2d-empty">Pianta non ancora preparata dal Centro Congressi.</p>}<section><h3>Elementi da preparare</h3>{summary.length?<ul>{summary.map(row=><li key={row.type}><span>{row.label}</span><strong>{row.count}</strong></li>)}</ul>:<p className="rs-sale2d-empty">Nessun elemento inserito.</p>}</section><p className="rs-sale2d-workflow-note">Lo stato Fatto / Da finire si aggiorna dalla card Planning, insieme ai controlli sala esistenti.</p></div>
}

function LayoutHistory({ rows, currentVersion, busy, onRestore }) {
  return <section className="rs-sale2d-history" aria-label="Storico allestimento"><h3>Storico versioni</h3>{rows.length?<ul>{rows.map(row=><li key={row.id || row.version}><div><strong>v{row.version}{row.version===currentVersion?' · attiva':''}</strong><small>{formatHistoryDate(row.createdAt)} · {row.reason || 'Modifica layout'}</small></div>{row.version!==currentVersion?<Button size="sm" variant="ghost" disabled={busy} onClick={()=>onRestore(row.version)}>Ripristina</Button>:null}</li>)}</ul>:<p className="rs-sale2d-empty">Nessuna versione precedente disponibile.</p>}</section>
}

export default function RandSale2D({ booking, user, onClose }) {
  const editable=canManageSalePlanning(user), fallback={roomKey:booking.roomKey,roomName:booking.room,layoutKey:booking.layoutKey,layoutName:booking.layout,pax:booking.pax}
  const [snapshot,setSnapshot]=useState(null),[history,setHistory]=useState(()=>[createLayoutDocument(fallback)]),[cursor,setCursor]=useState(0),[selectedId,setSelectedId]=useState(null),[zoom,setZoom]=useState(1),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[historyOpen,setHistoryOpen]=useState(false),[remoteHistory,setRemoteHistory]=useState([]),[reason,setReason]=useState('Modifica allestimento')
  const document=history[cursor]
  useEffect(()=>{let active=true;fetchSaleLayoutSnapshot(booking.id,booking.hotelId).then(row=>{if(!active)return;const doc=row?.document?bindLayoutDocument(row.document,booking):createLayoutDocument(fallback);setSnapshot(row);setHistory([doc]);setCursor(0)}).catch(err=>active&&setError(err.message)).finally(()=>active&&setLoading(false));return()=>{active=false}},[booking.id,booking.hotelId,booking.roomKey,booking.room,booking.layoutKey,booking.layout,booking.pax])
  const commit=next=>{const normalized=normalizeLayoutDocument(next);setHistory(current=>[...current.slice(0,cursor+1),normalized].slice(-MAX_HISTORY));setCursor(current=>Math.min(current+1,MAX_HISTORY-1))}
  const replace=next=>setHistory(current=>current.map((entry,index)=>index===cursor?normalizeLayoutDocument(next):entry))
  const add=type=>commit(addLayoutItem(document,type)), update=(id,patch)=>commit(updateLayoutItem(document,id,patch)), move=(id,patch)=>replace(updateLayoutItem(document,id,patch)), remove=()=>{if(selectedId){commit(removeLayoutItem(document,selectedId));setSelectedId(null)}}
  const selected=document?.items.find(item=>item.id===selectedId)
  const refreshHistory=async()=>{const rows=await fetchSaleLayoutHistory(booking.id,booking.hotelId);setRemoteHistory(rows);return rows}
  const toggleHistory=async()=>{const next=!historyOpen;setHistoryOpen(next);if(next){setError('');try{await refreshHistory()}catch(err){setError(err.message||'Storico non disponibile')}}}
  const save=async()=>{setBusy(true);setError('');try{const saved=await saveSaleLayoutSnapshot({bookingId:booking.id,hotelId:booking.hotelId,document:bindLayoutDocument(document,booking),expectedVersion:snapshot?.version||0,reason});setSnapshot(saved);setHistory([bindLayoutDocument(saved.document,booking)]);setCursor(0);if(historyOpen)await refreshHistory()}catch(err){setError(err.message||'Pianta non salvata')}finally{setBusy(false)}}
  const restore=async sourceVersion=>{if(!snapshot?.version)return;setBusy(true);setError('');try{const saved=await restoreSaleLayoutSnapshot({bookingId:booking.id,hotelId:booking.hotelId,sourceVersion,expectedVersion:snapshot.version});setSnapshot(saved);setHistory([bindLayoutDocument(saved.document,booking)]);setCursor(0);setSelectedId(null);await refreshHistory()}catch(err){setError(err.message||'Ripristino non riuscito')}finally{setBusy(false)}}
  return <Sheet open onClose={onClose} className="rs-sale2d-sheet"><header className="rs-sale2d-head"><div><small>RANDSALE 2D</small><h2>{editable?'Editor allestimento':'Modalità facchini'}</h2><span>{booking.room} · {booking.client}</span></div><IconButton icon="close" label="Chiudi" onClick={onClose}/></header>{loading?<p className="rs-sale2d-empty">Caricamento pianta…</p>:editable?<div className="rs-sale2d-editor">
    <div className="rs-sale2d-toolbar" aria-label="Oggetti sala">{Object.entries(RANDSALE2D_TYPES).map(([type,item])=><button key={type} type="button" onClick={()=>add(type)}><i style={{background:item.color}}/>{item.label}</button>)}</div>
    <div className="rs-sale2d-controls"><Button size="sm" variant="ghost" disabled={cursor===0} onClick={()=>setCursor(value=>value-1)}>↶ Annulla</Button><Button size="sm" variant="ghost" disabled={cursor===history.length-1} onClick={()=>setCursor(value=>value+1)}>↷ Ripeti</Button><Button size="sm" variant="ghost" onClick={()=>setZoom(value=>Math.max(.75,value-.25))}>−</Button><span>{Math.round(zoom*100)}%</span><Button size="sm" variant="ghost" onClick={()=>setZoom(value=>Math.min(2,value+.25))}>+</Button><Button size="sm" variant="ghost" onClick={toggleHistory}>{historyOpen?'Chiudi storico':'Storico'}</Button></div>
    <LayoutCanvas document={document} selectedId={selectedId} onSelect={setSelectedId} onMove={move} onMoveEnd={()=>commit(document)} zoom={zoom}/>
    {selected?<section className="rs-sale2d-inspector"><label>Nome<input value={selected.label} onChange={event=>update(selected.id,{label:event.target.value})}/></label><label>Larghezza cm<input type="number" min="20" value={selected.width} onChange={event=>update(selected.id,{width:Number(event.target.value)})}/></label><label>Profondità cm<input type="number" min="20" value={selected.height} onChange={event=>update(selected.id,{height:Number(event.target.value)})}/></label><label>Rotazione<select value={selected.rotation} onChange={event=>update(selected.id,{rotation:Number(event.target.value)})}>{[0,45,90,135,180,225,270,315].map(value=><option key={value} value={value}>{value}°</option>)}</select></label><Button variant="danger" size="sm" onClick={remove}>Rimuovi</Button></section>:<p className="rs-sale2d-hint">Tocca un elemento per selezionarlo; trascinalo per posizionarlo sulla griglia.</p>}
    <label className="rs-sale2d-reason">Motivo modifica<input value={reason} maxLength="120" onChange={event=>setReason(event.target.value)} placeholder="Es. palco spostato su richiesta cliente"/></label>
    {historyOpen?<LayoutHistory rows={remoteHistory} currentVersion={snapshot?.version||0} busy={busy} onRestore={restore}/>:null}
    {error?<p className="rs-sale2d-error">{error}</p>:null}<Button disabled={busy||String(booking.id).startsWith('offline-')} onClick={save}>{busy?'Salvataggio…':`Salva pianta${snapshot?` · v${snapshot.version}`:''}`}</Button>
  </div>:<Viewer booking={booking} snapshot={snapshot}/>}</Sheet>
}
