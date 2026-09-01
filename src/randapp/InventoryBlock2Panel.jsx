import { useEffect, useMemo, useRef, useState } from 'react'
import {
  addCompatibility,
  countStocktakeLine,
  fetchCompatibility,
  fetchInventoryHotels,
  fetchInventoryTransfers,
  fetchOpenStocktake,
  fetchSerialUnits,
  fetchStocktakeLines,
  finalizeStocktake,
  findInventoryByCode,
  getInventoryQrSvg,
  inventoryDeepLink,
  openStocktake,
  receiveInventoryTransfer,
  registerSerialUnit,
  startInventoryTransfer,
} from '../inventory-block2-data.js'
import { canUser } from '../permissions.js'
import { Badge, Button, Card, Field, Icon, Sheet, TextInput } from './ui.jsx'

const fmt = (value) => Number(value || 0).toLocaleString('it-IT', { maximumFractionDigits: 3 })

function ScannerSheet({ open, hotel, items, onClose, onFound }) {
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')
  const [camera, setCamera] = useState(false)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const stoppedRef = useRef(false)
  const resolve = async (raw) => {
    const value = String(raw || '').trim()
    if (!value) return
    setMessage('Cerco…')
    try {
      const found = await findInventoryByCode(hotel.id, value)
      if (!found) return setMessage('Codice non trovato in questa struttura.')
      if (found.kind === 'hotel_mismatch') return setMessage(`Questo QR appartiene alla struttura ${found.hotelId}.`)
      if (found.itemId) { onFound(found.itemId); setMessage('Articolo trovato.'); onClose(); return }
      if (found.kind === 'location') setMessage(`Ubicazione: ${found.location.name}`)
    } catch (err) { setMessage(err?.message || 'Ricerca non riuscita') }
  }
  useEffect(() => {
    if (!open) return
    const incoming = new URLSearchParams(window.location.search).get('inventoryCode')
    if (incoming) resolve(incoming)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hotel.id])
  useEffect(() => () => { stoppedRef.current = true; streamRef.current?.getTracks?.().forEach((t) => t.stop()) }, [])
  const startCamera = async () => {
    if (!('BarcodeDetector' in window)) return setMessage('Scanner fotocamera non disponibile qui: usa Fotocamera iPhone sul QR, un lettore USB/Bluetooth o inserisci il codice.')
    try {
      stoppedRef.current = false
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      streamRef.current = stream; setCamera(true)
      await new Promise((r) => setTimeout(r, 50))
      if (!videoRef.current) return
      videoRef.current.srcObject = stream; await videoRef.current.play()
      const detector = new window.BarcodeDetector({ formats: ['qr_code','code_128','ean_13','ean_8','upc_a','upc_e','data_matrix'] })
      const loop = async () => {
        if (stoppedRef.current || !videoRef.current) return
        try { const hits = await detector.detect(videoRef.current); if (hits?.[0]?.rawValue) { stream.getTracks().forEach((t) => t.stop()); stoppedRef.current = true; return resolve(hits[0].rawValue) } } catch {}
        requestAnimationFrame(loop)
      }
      loop()
    } catch (err) { setMessage(err?.message || 'Fotocamera non disponibile') }
  }
  const close = () => { stoppedRef.current = true; streamRef.current?.getTracks?.().forEach((t) => t.stop()); setCamera(false); onClose() }
  return <Sheet open={open} onClose={close} title="Scansiona Magazzino" className="rs-inventory-sheet"><div className="rs-actions-stack">
    {camera && <video ref={videoRef} className="rs-inventory-scanner-video" muted playsInline />}
    <Button variant="primary" icon="camera" onClick={startCamera}>Apri scanner</Button>
    <Field label="Codice / barcode / seriale"><TextInput value={code} autoCapitalize="characters" onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') resolve(code) }} /></Field>
    <Button variant="ghost" onClick={() => resolve(code)}>Cerca codice</Button>
    <p className="rs-field__hint">I lettori USB/Bluetooth funzionano come tastiera. Il QR RandApp può essere aperto anche dalla Fotocamera di sistema su iPhone.</p>
    {message && <p className="rs-field__hint">{message}</p>}
  </div></Sheet>
}

function LabelSheet({ open, hotel, items, onClose }) {
  const [itemId, setItemId] = useState('')
  const [svg, setSvg] = useState('')
  const [error, setError] = useState('')
  const item = items.find((i) => i.id === itemId)
  useEffect(() => { if (!open) { setSvg(''); setError('') } }, [open])
  const generate = async () => {
    if (!item?.scanCode) return setError('Codice QR non ancora disponibile per questo articolo.')
    try { setError(''); setSvg(await getInventoryQrSvg(inventoryDeepLink(hotel.id, item.scanCode))) } catch (err) { setError(err?.message || 'QR non generato') }
  }
  return <Sheet open={open} onClose={onClose} title="Etichetta QR" className="rs-inventory-sheet"><div className="rs-actions-stack">
    <Field label="Articolo"><select className="rs-select" value={itemId} onChange={(e) => { setItemId(e.target.value); setSvg('') }}><option value="">Seleziona…</option>{items.map((i) => <option key={i.id} value={i.id}>{i.name}{i.variantLabel ? ` · ${i.variantLabel}` : ''}</option>)}</select></Field>
    {item && <Card><small>CODICE RANDAPP</small><strong>{item.scanCode || '—'}</strong>{item.barcode && <p>Barcode fornitore: {item.barcode}</p>}</Card>}
    <Button variant="primary" disabled={!itemId} onClick={generate}>Genera QR</Button>
    {svg && <div className="rs-inventory-qr" role="img" aria-label={`QR ${item?.name || ''}`} dangerouslySetInnerHTML={{ __html: svg }} />}
    {svg && <Button variant="ghost" onClick={() => window.print()}>Stampa etichetta</Button>}
    {error && <p className="rs-error">{error}</p>}
  </div></Sheet>
}

function StocktakeSheet({ open, hotel, items, locations, onClose, onReload }) {
  const [take, setTake] = useState(null)
  const [lines, setLines] = useState([])
  const [locationId, setLocationId] = useState('')
  const [drafts, setDrafts] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const load = async () => { const current = await fetchOpenStocktake(hotel.id); setTake(current); const next = current ? await fetchStocktakeLines(current.id) : []; setLines(next); setDrafts(Object.fromEntries(next.map((l) => [l.id, l.countedQuantity ?? '']))) }
  useEffect(() => { if (open) load().catch((e) => setError(e.message)) }, [open, hotel.id])
  const start = async () => { setBusy(true); setError(''); try { await openStocktake(hotel.id, locationId || null); await load() } catch (e) { setError(e.message) } finally { setBusy(false) } }
  const saveLine = async (line) => { const value = Number(drafts[line.id]); if (!Number.isFinite(value) || value < 0) return; setBusy(true); try { await countStocktakeLine(line.id, value); await load() } catch (e) { setError(e.message) } finally { setBusy(false) } }
  const finish = async () => { setBusy(true); try { await finalizeStocktake(take.id); await load(); await onReload() } catch (e) { setError(e.message) } finally { setBusy(false) } }
  const complete = lines.length > 0 && lines.every((l) => l.countedQuantity != null)
  return <Sheet open={open} onClose={onClose} title="Inventario fisico" className="rs-inventory-sheet"><div className="rs-actions-stack">
    {!take ? <><Field label="Ambito"><select className="rs-select" value={locationId} onChange={(e) => setLocationId(e.target.value)}><option value="">Intera struttura</option>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></Field><Button variant="primary" disabled={busy} onClick={start}>Apri inventario</Button><p className="rs-field__hint">All'apertura viene congelata la giacenza attesa. La chiusura applica tutte le differenze in una sola transazione.</p></> : <>
      <Card><small>INVENTARIO APERTO</small><strong>{lines.filter((l) => l.countedQuantity != null).length}/{lines.length}</strong></Card>
      <div className="rs-inventory-count-list">{lines.map((line) => { const item = items.find((i) => i.id === line.itemId); const diff = line.countedQuantity == null ? null : line.countedQuantity - line.expectedQuantity; return <div className="rs-inventory-count-row" key={line.id}><div><strong>{item?.name || line.itemId}</strong><small>Atteso {fmt(line.expectedQuantity)}{diff != null ? ` · differenza ${diff > 0 ? '+' : ''}${fmt(diff)}` : ''}</small></div><TextInput type="number" min="0" step="0.001" value={drafts[line.id] ?? ''} onChange={(e) => setDrafts({ ...drafts, [line.id]: e.target.value })} /><Button variant="ghost" disabled={busy} onClick={() => saveLine(line)}>Salva</Button></div> })}</div>
      <Button variant="primary" disabled={!complete || busy} onClick={finish}>Chiudi e riconcilia</Button>
    </>}
    {error && <p className="rs-error">{error}</p>}
  </div></Sheet>
}

function TransferSheet({ open, hotel, items, onClose, onReload }) {
  const [hotels, setHotels] = useState([])
  const [transfers, setTransfers] = useState([])
  const [itemId, setItemId] = useState('')
  const [destination, setDestination] = useState('')
  const [qty, setQty] = useState('1')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const load = async () => { const [hs, ts] = await Promise.all([fetchInventoryHotels(), fetchInventoryTransfers(hotel.id)]); setHotels(hs); setTransfers(ts) }
  useEffect(() => { if (open) load().catch((e) => setError(e.message)) }, [open, hotel.id])
  const send = async () => { setBusy(true); setError(''); try { await startInventoryTransfer(itemId, destination, Number(qty), note); setItemId(''); setDestination(''); setQty('1'); setNote(''); await load(); await onReload() } catch (e) { setError(e.message) } finally { setBusy(false) } }
  const receive = async (id) => { setBusy(true); try { await receiveInventoryTransfer(id); await load(); await onReload() } catch (e) { setError(e.message) } finally { setBusy(false) } }
  const otherHotels = hotels.filter((h) => h.id !== hotel.id)
  return <Sheet open={open} onClose={onClose} title="Trasferimenti" className="rs-inventory-sheet"><div className="rs-actions-stack">
    <Field label="Articolo"><select className="rs-select" value={itemId} onChange={(e) => setItemId(e.target.value)}><option value="">Seleziona…</option>{items.filter((i) => i.quantity > 0).map((i) => <option key={i.id} value={i.id}>{i.name} · {fmt(i.quantity)} {i.unit}</option>)}</select></Field>
    <div className="rs-inventory-form-grid"><Field label="Destinazione"><select className="rs-select" value={destination} onChange={(e) => setDestination(e.target.value)}><option value="">Seleziona…</option>{otherHotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select></Field><Field label="Quantità"><TextInput type="number" min="0.001" step="0.001" value={qty} onChange={(e) => setQty(e.target.value)} /></Field></div>
    <Field label="Nota"><TextInput value={note} placeholder="Es. trasferimento urgente" onChange={(e) => setNote(e.target.value)} /></Field>
    <Button variant="primary" disabled={!itemId || !destination || Number(qty) <= 0 || busy} onClick={send}>Spedisci</Button>
    <h3>In transito / recenti</h3>{transfers.length === 0 ? <p className="rs-field__hint">Nessun trasferimento.</p> : transfers.map((t) => <Card key={t.id}><div className="rs-inventory-transfer-row"><div><strong>{items.find((i) => i.id === t.sourceItemId)?.name || 'Articolo trasferito'}</strong><small>{t.sourceHotelId} → {t.destinationHotelId} · {fmt(t.quantity)}</small></div><Badge>{t.status === 'received' ? 'Ricevuto' : 'In transito'}</Badge>{t.status === 'in_transit' && t.destinationHotelId === hotel.id && <Button variant="primary" disabled={busy} onClick={() => receive(t.id)}>Ricevi</Button>}</div></Card>)}
    {error && <p className="rs-error">{error}</p>}
  </div></Sheet>
}

function TraceSheet({ open, hotel, items, locations, onClose }) {
  const [itemId, setItemId] = useState('')
  const [serials, setSerials] = useState([])
  const [compatibility, setCompatibility] = useState([])
  const [serial, setSerial] = useState('')
  const [serialBarcode, setSerialBarcode] = useState('')
  const [serialLocation, setSerialLocation] = useState('')
  const [target, setTarget] = useState('')
  const [relation, setRelation] = useState('compatible')
  const [error, setError] = useState('')
  const load = async (id = itemId) => { if (!id) { setSerials([]); setCompatibility([]); return } const [s, c] = await Promise.all([fetchSerialUnits(id), fetchCompatibility(id)]); setSerials(s); setCompatibility(c) }
  useEffect(() => { if (open && itemId) load().catch((e) => setError(e.message)) }, [open, itemId])
  const addSerial = async () => { try { await registerSerialUnit(hotel.id, itemId, { serialNumber: serial, barcode: serialBarcode, locationId: serialLocation || null }); setSerial(''); setSerialBarcode(''); await load() } catch (e) { setError(e.message) } }
  const addCompat = async () => { try { await addCompatibility(hotel.id, itemId, target, relation); setTarget(''); await load() } catch (e) { setError(e.message) } }
  return <Sheet open={open} onClose={onClose} title="Seriali e compatibilità" className="rs-inventory-sheet"><div className="rs-actions-stack">
    <Field label="Articolo"><select className="rs-select" value={itemId} onChange={(e) => setItemId(e.target.value)}><option value="">Seleziona…</option>{items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select></Field>
    {itemId && <><h3>Unità serializzate</h3><div className="rs-inventory-form-grid"><Field label="Seriale"><TextInput value={serial} onChange={(e) => setSerial(e.target.value)} /></Field><Field label="Barcode"><TextInput value={serialBarcode} onChange={(e) => setSerialBarcode(e.target.value)} /></Field></div><Field label="Ubicazione"><select className="rs-select" value={serialLocation} onChange={(e) => setSerialLocation(e.target.value)}><option value="">Non specificata</option>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></Field><Button variant="ghost" disabled={!serial.trim()} onClick={addSerial}>Registra seriale</Button>
    {serials.map((s) => <Card key={s.id}><strong>{s.assetTag}</strong><p>{s.serialNumber}{s.barcode ? ` · ${s.barcode}` : ''}</p><small>{s.status} · {s.condition}</small></Card>)}
    <h3>Compatibilità</h3><div className="rs-inventory-form-grid"><Field label="Con"><select className="rs-select" value={target} onChange={(e) => setTarget(e.target.value)}><option value="">Seleziona…</option>{items.filter((i) => i.id !== itemId).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select></Field><Field label="Relazione"><select className="rs-select" value={relation} onChange={(e) => setRelation(e.target.value)}><option value="compatible">Compatibile</option><option value="equivalent">Equivalente</option><option value="replaces">Sostituisce</option><option value="accessory">Accessorio</option><option value="incompatible">Incompatibile</option></select></Field></div><Button variant="ghost" disabled={!target} onClick={addCompat}>Aggiungi relazione</Button>
    {compatibility.map((c) => { const other = c.sourceItemId === itemId ? c.targetItemId : c.sourceItemId; return <Card key={c.id}><strong>{items.find((i) => i.id === other)?.name || other}</strong><small>{c.relation}</small></Card> })}</>}
    {error && <p className="rs-error">{error}</p>}
  </div></Sheet>
}

export default function InventoryBlock2Panel({ user, hotel, items, locations, onSelectItem, onReload }) {
  const [sheet, setSheet] = useState('')
  const canEdit = canUser(user, 'inventory', 'edit')
  useEffect(() => {
    const incoming = new URLSearchParams(window.location.search).get('inventoryCode')
    if (incoming) setSheet('scan')
  }, [hotel.id])
  const actions = useMemo(() => [
    ['scan','scan','Scansiona','QR, barcode, seriale'],['label','package','Etichetta QR','Genera e stampa'],['stocktake','check','Inventario','Conta e riconcilia'],['trace','settings','Seriali','Tracciabilità e compatibilità'],['transfer','arrowRight','Trasferisci','Tra strutture'],
  ], [])
  return <><div className="rs-inventory-block2-actions">{actions.map(([key, icon, title, subtitle]) => <Card as="button" key={key} onClick={() => setSheet(key)} disabled={!canEdit && key !== 'scan' && key !== 'label'}><Icon name={icon} /><span><strong>{title}</strong><small>{subtitle}</small></span></Card>)}</div>
    <ScannerSheet open={sheet === 'scan'} hotel={hotel} items={items} onClose={() => setSheet('')} onFound={onSelectItem} />
    <LabelSheet open={sheet === 'label'} hotel={hotel} items={items} onClose={() => setSheet('')} />
    <StocktakeSheet open={sheet === 'stocktake'} hotel={hotel} items={items} locations={locations} onClose={() => setSheet('')} onReload={onReload} />
    <TraceSheet open={sheet === 'trace'} hotel={hotel} items={items} locations={locations} onClose={() => setSheet('')} />
    <TransferSheet open={sheet === 'transfer'} hotel={hotel} items={items} onClose={() => setSheet('')} onReload={onReload} />
  </>
}
