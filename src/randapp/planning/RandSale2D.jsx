import { useEffect, useRef, useState } from 'react'
import { fetchSaleLayoutSnapshot, saveSaleLayoutSnapshot } from '../../randsale2d-data.js'
import { RANDSALE2D_TYPES, addLayoutItem, createLayoutDocument, normalizeLayoutDocument, removeLayoutItem, snapValue, summarizeLayout, updateLayoutItem } from '../../randsale2d-model.js'
import { updateBookingRow } from '../../sale-data.js'
import { Button, IconButton, Sheet } from '../ui.jsx'
import { canManageSalePlanning } from './sale-utils.js'

const MAX_HISTORY = 30
const percent = value => `${value}%`

function LayoutCanvas({ document, selectedId, onSelect, onMove, onMoveEnd, readonly, zoom }) {
  const pointer = useRef(null), doc = normalizeLayoutDocument(document), scaleX = 100 / doc.room.width, scaleY = 100 / doc.room.height
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

function Viewer({ booking, snapshot, user, onRefresh }) {
  const [busy,setBusy]=useState(false), doc=snapshot?.document, summary=doc?summarizeLayout(doc):[]
  const checksReady=(!booking.audioRequired||booking.audioStatus==='ok')&&(!booking.videoRequired||booking.videoStatus==='ok')
  const status = async next => { if(next==='done'&&!checksReady){window.alert('Completa prima i controlli Audio/Video richiesti oppure impostali come N.R.');return} setBusy(true); try { const patch=next==='done'?{status:'done',doneBy:user.name,doneAt:Date.now()}:{status:'da_finire',toFinishBy:user.name,toFinishAt:Date.now(),doneBy:null,doneAt:null}; await updateBookingRow(booking.id,{...patch,hotelId:booking.hotelId}); await onRefresh?.() } finally { setBusy(false) } }
  return <div className="rs-sale2d-viewer"><div className="rs-sale2d-readonly"><span>Sola lettura</span><strong>{booking.room} · {booking.layout || 'Allestimento'}</strong><small>{booking.pax || '—'} PAX · versione {snapshot?.version || 0}</small></div>{doc?<LayoutCanvas document={doc} readonly zoom={1} selectedId={null} onSelect={()=>{}} onMove={()=>{}}/>:<p className="rs-sale2d-empty">Pianta non ancora preparata dal Centro Congressi.</p>}<section><h3>Elementi da preparare</h3>{summary.length?<ul>{summary.map(row=><li key={row.type}><span>{row.label}</span><strong>{row.count}</strong></li>)}</ul>:<p className="rs-sale2d-empty">Nessun elemento inserito.</p>}</section><div className="rs-sale2d-status"><Button variant="ghost" disabled={busy} onClick={()=>status('da_finire')}>◐ Non fatto / da finire</Button><Button disabled={busy} onClick={()=>status('done')}>✓ Fatto</Button></div></div>
}

export default function RandSale2D({ booking, user, onClose, onRefresh }) {
  const editable=canManageSalePlanning(user), fallback={roomKey:booking.roomKey,roomName:booking.room,layoutKey:booking.layoutKey,layoutName:booking.layout,pax:booking.pax}
  const [snapshot,setSnapshot]=useState(null),[history,setHistory]=useState(()=>[createLayoutDocument(fallback)]),[cursor,setCursor]=useState(0),[selectedId,setSelectedId]=useState(null),[zoom,setZoom]=useState(1),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const document=history[cursor]
  useEffect(()=>{let active=true;fetchSaleLayoutSnapshot(booking.id,booking.hotelId).then(row=>{if(!active)return;const doc=normalizeLayoutDocument(row?.document,fallback);setSnapshot(row);setHistory([doc]);setCursor(0)}).catch(err=>setError(err.message)).finally(()=>active&&setLoading(false));return()=>{active=false}},[booking.id,booking.hotelId])
  const commit=next=>{const normalized=normalizeLayoutDocument(next);setHistory(current=>[...current.slice(0,cursor+1),normalized].slice(-MAX_HISTORY));setCursor(current=>Math.min(current+1,MAX_HISTORY-1))}
  const replace=next=>setHistory(current=>current.map((entry,index)=>index===cursor?normalizeLayoutDocument(next):entry))
  const add=type=>commit(addLayoutItem(document,type)), update=(id,patch)=>commit(updateLayoutItem(document,id,patch)), move=(id,patch)=>replace(updateLayoutItem(document,id,patch)), remove=()=>{if(selectedId){commit(removeLayoutItem(document,selectedId));setSelectedId(null)}}
  const selected=document?.items.find(item=>item.id===selectedId)
  const save=async()=>{setBusy(true);setError('');try{const saved=await saveSaleLayoutSnapshot({bookingId:booking.id,hotelId:booking.hotelId,document,expectedVersion:snapshot?.version||0});setSnapshot(saved);setHistory([saved.document]);setCursor(0)}catch(err){setError(err.message||'Pianta non salvata')}finally{setBusy(false)}}
  return <Sheet open onClose={onClose} className="rs-sale2d-sheet"><header className="rs-sale2d-head"><div><small>RANDSALE 2D</small><h2>{editable?'Editor allestimento':'Modalità facchini'}</h2><span>{booking.room} · {booking.client}</span></div><IconButton icon="close" label="Chiudi" onClick={onClose}/></header>{loading?<p className="rs-sale2d-empty">Caricamento pianta…</p>:editable?<div className="rs-sale2d-editor">
    <div className="rs-sale2d-toolbar" aria-label="Oggetti sala">{Object.entries(RANDSALE2D_TYPES).map(([type,item])=><button key={type} type="button" onClick={()=>add(type)}><i style={{background:item.color}}/>{item.label}</button>)}</div>
    <div className="rs-sale2d-controls"><Button size="sm" variant="ghost" disabled={cursor===0} onClick={()=>setCursor(value=>value-1)}>↶ Annulla</Button><Button size="sm" variant="ghost" disabled={cursor===history.length-1} onClick={()=>setCursor(value=>value+1)}>↷ Ripeti</Button><Button size="sm" variant="ghost" onClick={()=>setZoom(value=>Math.max(.75,value-.25))}>−</Button><span>{Math.round(zoom*100)}%</span><Button size="sm" variant="ghost" onClick={()=>setZoom(value=>Math.min(2,value+.25))}>+</Button></div>
    <LayoutCanvas document={document} selectedId={selectedId} onSelect={setSelectedId} onMove={move} onMoveEnd={()=>commit(document)} zoom={zoom}/>
    {selected?<section className="rs-sale2d-inspector"><label>Nome<input value={selected.label} onChange={event=>update(selected.id,{label:event.target.value})}/></label><label>Larghezza cm<input type="number" min="20" value={selected.width} onChange={event=>update(selected.id,{width:Number(event.target.value)})}/></label><label>Profondità cm<input type="number" min="20" value={selected.height} onChange={event=>update(selected.id,{height:Number(event.target.value)})}/></label><label>Rotazione<select value={selected.rotation} onChange={event=>update(selected.id,{rotation:Number(event.target.value)})}>{[0,45,90,135,180,225,270,315].map(value=><option key={value} value={value}>{value}°</option>)}</select></label><Button variant="danger" size="sm" onClick={remove}>Rimuovi</Button></section>:<p className="rs-sale2d-hint">Tocca un elemento per selezionarlo; trascinalo per posizionarlo sulla griglia.</p>}
    {error?<p className="rs-sale2d-error">{error}</p>:null}<Button disabled={busy||String(booking.id).startsWith('offline-')} onClick={save}>{busy?'Salvataggio…':`Salva pianta${snapshot?` · v${snapshot.version}`:''}`}</Button>
  </div>:<Viewer booking={booking} snapshot={snapshot} user={user} onRefresh={onRefresh}/>}</Sheet>
}
