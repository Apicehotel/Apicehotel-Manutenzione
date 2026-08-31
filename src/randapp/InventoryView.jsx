import { useEffect, useMemo, useState } from 'react'
import { adjustInventoryStock, createInventoryItem, fetchInventoryItems, fetchInventoryMovements, getInventoryPhotoUrl, subscribeInventory } from '../inventory-data.js'
import { canUser } from '../permissions.js'
import { Badge, Button, Card, EmptyState, Field, Icon, Sheet, Spinner, TextInput } from './ui.jsx'
import './inventory.css'

const EMPTY = { name: '', category: 'Ricambi', unit: 'pz', location: '', sku: '', quantity: '0', minQuantity: '0', notes: '', photo: null }

function fmt(value) {
  const n = Number(value || 0)
  return Number.isInteger(n) ? String(n) : n.toLocaleString('it-IT', { maximumFractionDigits: 3 })
}


function InventoryPhoto({ path, className = '' }) {
  const [url, setUrl] = useState('')
  useEffect(() => { let alive = true; setUrl(''); if (path) getInventoryPhotoUrl(path).then((v) => { if (alive) setUrl(v) }).catch(() => {}); return () => { alive = false } }, [path])
  return url ? <img className={className} src={url} alt="Foto articolo" loading="lazy" /> : <span className={`rs-inventory-photo-placeholder ${className}`}><Icon name="package" /></span>
}

function NewItemSheet({ open, onClose, onSave }) {
  const [draft, setDraft] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { if (open) { setDraft(EMPTY); setError('') } }, [open])
  const save = async () => {
    if (!draft.name.trim() || busy) return
    setBusy(true); setError('')
    try { await onSave(draft); onClose() }
    catch (err) { setError(err?.message || 'Articolo non salvato') }
    finally { setBusy(false) }
  }
  return (
    <Sheet open={open} onClose={onClose} title="Nuovo articolo" className="rs-inventory-sheet">
      <div className="rs-actions-stack">
        <Field label="Nome"><TextInput value={draft.name} placeholder="Es. Top mensola Wine" onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
        <div className="rs-inventory-form-grid">
          <Field label="Categoria"><TextInput value={draft.category} placeholder="Ricambi" onChange={(e) => setDraft({ ...draft, category: e.target.value })} /></Field>
          <Field label="Unità"><TextInput value={draft.unit} placeholder="pz" onChange={(e) => setDraft({ ...draft, unit: e.target.value })} /></Field>
        </div>
        <Field label="Posizione"><TextInput value={draft.location} placeholder="Es. Magazzino 1 · scaffale B" onChange={(e) => setDraft({ ...draft, location: e.target.value })} /></Field>
        <div className="rs-inventory-form-grid">
          <Field label="Quantità iniziale"><TextInput type="number" min="0" step="0.001" inputMode="decimal" value={draft.quantity} onChange={(e) => setDraft({ ...draft, quantity: e.target.value })} /></Field>
          <Field label="Scorta minima"><TextInput type="number" min="0" step="0.001" inputMode="decimal" value={draft.minQuantity} onChange={(e) => setDraft({ ...draft, minQuantity: e.target.value })} /></Field>
        </div>
        <Field label="Codice / SKU (facoltativo)"><TextInput value={draft.sku} onChange={(e) => setDraft({ ...draft, sku: e.target.value })} /></Field>
        <Field label="Foto articolo (facoltativa)"><label className="rs-inventory-photo-picker"><input type="file" accept="image/*" onChange={(e) => setDraft({ ...draft, photo: e.target.files?.[0] || null })} /><Icon name="camera" /><span><strong>{draft.photo ? draft.photo.name : 'Aggiungi foto'}</strong><small>Usa il selettore nativo: Libreria foto, Scatta foto oppure File, secondo il dispositivo.</small></span></label></Field>
        <Field label="Note"><textarea className="rs-textarea" rows="3" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></Field>
        {error && <p className="rs-error" role="alert">{error}</p>}
        <div className="rs-form-actions"><Button variant="ghost" onClick={onClose}>Annulla</Button><Button variant="primary" disabled={!draft.name.trim() || busy} onClick={save}>{busy ? 'Salvo…' : 'Aggiungi'}</Button></div>
      </div>
    </Sheet>
  )
}

function StockSheet({ item, open, onClose, onAdjusted }) {
  const [mode, setMode] = useState('out')
  const [qty, setQty] = useState('1')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [movements, setMovements] = useState([])
  useEffect(() => {
    if (!open || !item) return
    setMode('out'); setQty('1'); setNote(''); setError('')
    fetchInventoryMovements(item.id).then(setMovements).catch(() => setMovements([]))
  }, [open, item?.id])
  if (!item) return null
  const submit = async () => {
    const amount = Number(qty)
    if (!Number.isFinite(amount) || amount <= 0 || busy) return
    const delta = mode === 'in' ? amount : -amount
    setBusy(true); setError('')
    try {
      await onAdjusted(item.id, delta, note)
      const rows = await fetchInventoryMovements(item.id)
      setMovements(rows)
      setQty('1'); setNote('')
    } catch (err) { setError(err?.message || 'Movimento non registrato') }
    finally { setBusy(false) }
  }
  return (
    <Sheet open={open} onClose={onClose} title={item.name} className="rs-inventory-sheet">
      {item.photoPath && <InventoryPhoto path={item.photoPath} className="rs-inventory-photo-large" />}
      <div className="rs-inventory-balance"><small>Giacenza</small><strong>{fmt(item.quantity)} <span>{item.unit}</span></strong>{item.minQuantity > 0 && <em>Minimo {fmt(item.minQuantity)} {item.unit}</em>}</div>
      <div className="rs-segmented rs-inventory-movement-tabs">
        <button type="button" className={mode === 'out' ? 'active' : ''} onClick={() => setMode('out')}>Scarico</button>
        <button type="button" className={mode === 'in' ? 'active' : ''} onClick={() => setMode('in')}>Carico</button>
      </div>
      <div className="rs-actions-stack">
        <Field label={`Quantità (${item.unit})`}><TextInput type="number" min="0.001" step="0.001" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
        <Field label="Nota (facoltativa)"><TextInput value={note} placeholder={mode === 'out' ? 'Es. usata camera 214' : 'Es. consegna fornitore'} onChange={(e) => setNote(e.target.value)} /></Field>
        {error && <p className="rs-error" role="alert">{error}</p>}
        <Button variant="primary" disabled={busy || Number(qty) <= 0} onClick={submit}>{busy ? 'Registro…' : mode === 'out' ? 'Registra prelievo' : 'Registra carico'}</Button>
      </div>
      <div className="rs-inventory-history">
        <h3>Ultimi movimenti</h3>
        {movements.length === 0 ? <p className="rs-field__hint">Nessun movimento registrato.</p> : movements.map((m) => (
          <div className="rs-inventory-movement" key={m.id}>
            <span className={m.delta > 0 ? 'in' : 'out'}>{m.delta > 0 ? '+' : ''}{fmt(m.delta)} {item.unit}</span>
            <div><strong>{fmt(m.before)} → {fmt(m.after)}</strong>{m.note && <small>{m.note}</small>}</div>
            <time>{new Date(m.createdAt).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}</time>
          </div>
        ))}
      </div>
    </Sheet>
  )
}

export default function InventoryView({ user, hotel }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [lowOnly, setLowOnly] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const canCreate = canUser(user, 'inventory', 'create')
  const canEdit = canUser(user, 'inventory', 'edit')

  const reload = async () => {
    try { setItems(await fetchInventoryItems(hotel.id)) }
    finally { setLoading(false) }
  }
  useEffect(() => {
    setLoading(true); reload()
    const unsubscribe = subscribeInventory(hotel.id, reload)
    return () => unsubscribe?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotel.id])

  const categories = useMemo(() => Array.from(new Set(items.map((i) => i.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'it')), [items])
  const lowCount = useMemo(() => items.filter((i) => i.minQuantity > 0 && i.quantity <= i.minQuantity).length, [items])
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((i) => (category === 'all' || i.category === category) && (!lowOnly || (i.minQuantity > 0 && i.quantity <= i.minQuantity)) && (!q || `${i.name} ${i.category} ${i.location} ${i.sku}`.toLowerCase().includes(q)))
  }, [items, search, category, lowOnly])
  const selected = items.find((i) => i.id === selectedId) || null

  const create = async (draft) => { await createInventoryItem(hotel.id, draft); await reload() }
  const adjust = async (id, delta, note) => { await adjustInventoryStock(id, delta, note); await reload() }

  return (
    <div className="rs-inventory" data-testid="inventory-view">
      <div className="rs-page-title">
        <div><h1>Magazzino</h1><p>{hotel.name}</p></div>
        {canCreate && <Button variant="primary" icon="plus" onClick={() => setNewOpen(true)}>Articolo</Button>}
      </div>

      <div className="rs-inventory-summary">
        <Card><small>ARTICOLI</small><strong>{items.length}</strong></Card>
        <Card className={lowCount ? 'is-low' : ''}><small>SCORTA BASSA</small><strong>{lowCount}</strong></Card>
      </div>

      <div className="rs-toolbar rs-inventory-toolbar">
        <TextInput icon="search" value={search} placeholder="Cerca articolo, posizione, codice…" onChange={(e) => setSearch(e.target.value)} />
        <div className="rs-inventory-toolbar-row">
          <select className="rs-select" value={category} onChange={(e) => setCategory(e.target.value)}><option value="all">Tutte le categorie</option>{categories.map((c) => <option key={c} value={c}>{c}</option>)}</select>
          <button type="button" className={`rs-chip ${lowOnly ? 'active high' : ''}`} onClick={() => setLowOnly((v) => !v)}><Icon name="warning" /> Sotto scorta{lowCount ? ` · ${lowCount}` : ''}</button>
        </div>
      </div>

      {loading ? <Spinner label="Carico il magazzino…" /> : filtered.length === 0 ? <EmptyState icon="package" title="Magazzino vuoto">{items.length ? 'Nessun articolo corrisponde ai filtri.' : 'Aggiungi il primo articolo del magazzino.'}</EmptyState> : (
        <div className="rs-inventory-list">
          {filtered.map((item) => {
            const low = item.minQuantity > 0 && item.quantity <= item.minQuantity
            return (
              <Card as="button" className={`rs-inventory-item ${low ? 'is-low' : ''}`} key={item.id} onClick={() => canEdit && setSelectedId(item.id)}>
                <InventoryPhoto path={item.photoPath} className="rs-inventory-item__photo" />
                <span className="rs-inventory-item__main"><span className="rs-inventory-item__top"><strong>{item.name}</strong>{low && <Badge tone="high">Scorta bassa</Badge>}</span><small>{item.category}{item.location ? ` · ${item.location}` : ''}</small></span>
                <span className="rs-inventory-item__qty"><strong>{fmt(item.quantity)}</strong><small>{item.unit}</small></span>
                {canEdit && <Icon name="chevronRight" />}
              </Card>
            )
          })}
        </div>
      )}

      <NewItemSheet open={newOpen} onClose={() => setNewOpen(false)} onSave={create} />
      <StockSheet item={selected} open={Boolean(selected)} onClose={() => setSelectedId(null)} onAdjusted={adjust} />
    </div>
  )
}
