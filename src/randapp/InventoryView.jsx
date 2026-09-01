import { useEffect, useMemo, useState } from 'react'
import {
  adjustInventoryStock,
  createInventoryCategory,
  createInventoryItem,
  fetchInventoryCategories,
  fetchInventoryItems,
  fetchInventoryMovements,
  getInventoryPhotoUrl,
  subscribeInventory,
} from '../inventory-data.js'
import {
  flattenInventoryTree,
  INVENTORY_DEFAULT_ACTIONS,
  INVENTORY_ITEM_TYPES,
  inventorySearchText,
  inventoryStockStatus,
  suggestedInventoryReorder,
} from '../inventory-domain.js'
import { canUser } from '../permissions.js'
import { Badge, Button, Card, EmptyState, Field, Icon, Sheet, Spinner, TextInput } from './ui.jsx'
import './inventory.css'

const EMPTY = {
  name: '', category: 'Da classificare', categoryId: '', itemType: 'consumabile', unit: 'pz', location: '', sku: '', barcode: '',
  manufacturer: '', model: '', variantLabel: '', quantity: '0', minQuantity: '0', idealQuantity: '0', reorderQuantity: '0',
  tags: '', synonyms: '', notes: '', photo: null,
}

const EMPTY_CATEGORY = { name: '', parentId: '', synonyms: '', faultTerms: '', defaultAction: '' }
const splitList = (value) => String(value || '').split(',').map((v) => v.trim()).filter(Boolean)

function fmt(value) {
  const n = Number(value || 0)
  return Number.isInteger(n) ? String(n) : n.toLocaleString('it-IT', { maximumFractionDigits: 3 })
}

function InventoryPhoto({ path, className = '' }) {
  const [url, setUrl] = useState('')
  useEffect(() => { let alive = true; setUrl(''); if (path) getInventoryPhotoUrl(path).then((v) => { if (alive) setUrl(v) }).catch(() => {}); return () => { alive = false } }, [path])
  return url ? <img className={className} src={url} alt="Foto articolo" loading="lazy" /> : <span className={`rs-inventory-photo-placeholder ${className}`}><Icon name="package" /></span>
}

function CategorySheet({ open, categories, onClose, onSave }) {
  const [draft, setDraft] = useState(EMPTY_CATEGORY)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { if (open) { setDraft(EMPTY_CATEGORY); setError('') } }, [open])
  const flattened = useMemo(() => flattenInventoryTree(categories), [categories])
  const save = async () => {
    if (!draft.name.trim() || busy) return
    setBusy(true); setError('')
    try {
      await onSave({ ...draft, synonyms: splitList(draft.synonyms), faultTerms: splitList(draft.faultTerms) })
      onClose()
    } catch (err) { setError(err?.message || 'Categoria non salvata') }
    finally { setBusy(false) }
  }
  return (
    <Sheet open={open} onClose={onClose} title="Nuova categoria" className="rs-inventory-sheet">
      <div className="rs-actions-stack">
        <Field label="Nome"><TextInput value={draft.name} placeholder="Es. Guarnizioni" onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
        <Field label="Dentro (facoltativo)">
          <select className="rs-select" value={draft.parentId} onChange={(e) => setDraft({ ...draft, parentId: e.target.value })}>
            <option value="">Categoria principale</option>
            {flattened.map((c) => <option key={c.id} value={c.id}>{`${'— '.repeat(c.depth)}${c.name}`}</option>)}
          </select>
        </Field>
        <Field label="Sinonimi"><TextInput value={draft.synonyms} placeholder="Es. guarnizione, o-ring" onChange={(e) => setDraft({ ...draft, synonyms: e.target.value })} /></Field>
        <Field label="Parole di guasto"><TextInput value={draft.faultTerms} placeholder="Es. perde, rotta, crepata" onChange={(e) => setDraft({ ...draft, faultTerms: e.target.value })} /></Field>
        <Field label="Azione tipica">
          <select className="rs-select" value={draft.defaultAction} onChange={(e) => setDraft({ ...draft, defaultAction: e.target.value })}>
            <option value="">Nessuna</option>
            {INVENTORY_DEFAULT_ACTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </Field>
        <p className="rs-field__hint">Le parole di guasto appartengono al Magazzino: gli altri moduli potranno interrogarle, ma non modificano la giacenza.</p>
        {error && <p className="rs-error" role="alert">{error}</p>}
        <div className="rs-form-actions"><Button variant="ghost" onClick={onClose}>Annulla</Button><Button variant="primary" disabled={!draft.name.trim() || busy} onClick={save}>{busy ? 'Salvo…' : 'Crea categoria'}</Button></div>
      </div>
    </Sheet>
  )
}

function NewItemSheet({ open, categories, onClose, onSave, onNewCategory }) {
  const [draft, setDraft] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!open) return
    const fallback = categories.find((c) => c.code === 'DA_CLASSIFICARE')
    setDraft({ ...EMPTY, categoryId: fallback?.id || '', category: fallback?.name || 'Da classificare' })
    setError('')
  }, [open, categories])
  const flattened = useMemo(() => flattenInventoryTree(categories), [categories])
  const save = async () => {
    if (!draft.name.trim() || busy) return
    setBusy(true); setError('')
    try {
      await onSave({ ...draft, tags: splitList(draft.tags), synonyms: splitList(draft.synonyms) })
      onClose()
    } catch (err) { setError(err?.message || 'Articolo non salvato') }
    finally { setBusy(false) }
  }
  const selectCategory = (categoryId) => {
    const selected = categories.find((c) => c.id === categoryId)
    setDraft({ ...draft, categoryId, category: selected?.name || 'Da classificare' })
  }
  return (
    <Sheet open={open} onClose={onClose} title="Nuovo articolo" className="rs-inventory-sheet">
      <div className="rs-actions-stack">
        <Field label="Nome"><TextInput value={draft.name} placeholder="Es. Lampadina LED E27" onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
        <div className="rs-inventory-form-grid">
          <Field label="Categoria">
            <select className="rs-select" value={draft.categoryId} onChange={(e) => selectCategory(e.target.value)}>
              <option value="">Da classificare</option>
              {flattened.map((c) => <option key={c.id} value={c.id}>{`${'— '.repeat(c.depth)}${c.name}`}</option>)}
            </select>
          </Field>
          <Field label="Tipo">
            <select className="rs-select" value={draft.itemType} onChange={(e) => setDraft({ ...draft, itemType: e.target.value })}>
              {INVENTORY_ITEM_TYPES.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </Field>
        </div>
        <Button variant="ghost" icon="plus" onClick={onNewCategory}>Aggiungi categoria</Button>
        <div className="rs-inventory-form-grid">
          <Field label="Produttore"><TextInput value={draft.manufacturer} onChange={(e) => setDraft({ ...draft, manufacturer: e.target.value })} /></Field>
          <Field label="Modello"><TextInput value={draft.model} onChange={(e) => setDraft({ ...draft, model: e.target.value })} /></Field>
        </div>
        <div className="rs-inventory-form-grid">
          <Field label="Variante"><TextInput value={draft.variantLabel} placeholder="Es. E27 · 9W · 3000K" onChange={(e) => setDraft({ ...draft, variantLabel: e.target.value })} /></Field>
          <Field label="Unità"><TextInput value={draft.unit} placeholder="pz" onChange={(e) => setDraft({ ...draft, unit: e.target.value })} /></Field>
        </div>
        <Field label="Posizione"><TextInput value={draft.location} placeholder="Es. Magazzino tecnico · scaffale B" onChange={(e) => setDraft({ ...draft, location: e.target.value })} /></Field>
        <div className="rs-inventory-form-grid">
          <Field label="Quantità iniziale"><TextInput type="number" min="0" step="0.001" inputMode="decimal" value={draft.quantity} onChange={(e) => setDraft({ ...draft, quantity: e.target.value })} /></Field>
          <Field label="Scorta minima"><TextInput type="number" min="0" step="0.001" inputMode="decimal" value={draft.minQuantity} onChange={(e) => setDraft({ ...draft, minQuantity: e.target.value })} /></Field>
        </div>
        <div className="rs-inventory-form-grid">
          <Field label="Scorta ideale"><TextInput type="number" min="0" step="0.001" inputMode="decimal" value={draft.idealQuantity} onChange={(e) => setDraft({ ...draft, idealQuantity: e.target.value })} /></Field>
          <Field label="Quantità riordino"><TextInput type="number" min="0" step="0.001" inputMode="decimal" value={draft.reorderQuantity} onChange={(e) => setDraft({ ...draft, reorderQuantity: e.target.value })} /></Field>
        </div>
        <div className="rs-inventory-form-grid">
          <Field label="Codice / SKU"><TextInput value={draft.sku} onChange={(e) => setDraft({ ...draft, sku: e.target.value })} /></Field>
          <Field label="Barcode"><TextInput value={draft.barcode} inputMode="numeric" onChange={(e) => setDraft({ ...draft, barcode: e.target.value })} /></Field>
        </div>
        <Field label="Tag"><TextInput value={draft.tags} placeholder="Es. rubinetteria, acqua, 3/4" onChange={(e) => setDraft({ ...draft, tags: e.target.value })} /></Field>
        <Field label="Sinonimi articolo"><TextInput value={draft.synonyms} placeholder="Nomi alternativi separati da virgola" onChange={(e) => setDraft({ ...draft, synonyms: e.target.value })} /></Field>
        <Field label="Foto articolo (facoltativa)"><label className="rs-inventory-photo-picker"><input type="file" accept="image/*" onChange={(e) => setDraft({ ...draft, photo: e.target.files?.[0] || null })} /><Icon name="camera" /><span><strong>{draft.photo ? draft.photo.name : 'Aggiungi foto'}</strong><small>Libreria, Fotocamera o File secondo il dispositivo.</small></span></label></Field>
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
      await onAdjusted(item.id, delta, note, mode === 'in' ? 'carico' : 'scarico')
      setMovements(await fetchInventoryMovements(item.id))
      setQty('1'); setNote('')
    } catch (err) { setError(err?.message || 'Movimento non registrato') }
    finally { setBusy(false) }
  }
  const reorder = suggestedInventoryReorder(item)
  return (
    <Sheet open={open} onClose={onClose} title={item.name} className="rs-inventory-sheet">
      {item.photoPath && <InventoryPhoto path={item.photoPath} className="rs-inventory-photo-large" />}
      <div className="rs-inventory-balance"><small>Giacenza</small><strong>{fmt(item.quantity)} <span>{item.unit}</span></strong>{item.minQuantity > 0 && <em>Minimo {fmt(item.minQuantity)} {item.unit}{reorder > 0 ? ` · riordino suggerito ${fmt(reorder)}` : ''}</em>}</div>
      <div className="rs-segmented rs-inventory-movement-tabs">
        <button type="button" className={mode === 'out' ? 'active' : ''} onClick={() => setMode('out')}>Scarico</button>
        <button type="button" className={mode === 'in' ? 'active' : ''} onClick={() => setMode('in')}>Carico</button>
      </div>
      <div className="rs-actions-stack">
        <Field label={`Quantità (${item.unit})`}><TextInput type="number" min="0.001" step="0.001" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
        <Field label="Nota (facoltativa)"><TextInput value={note} placeholder={mode === 'out' ? 'Es. prelievo tecnico' : 'Es. consegna fornitore'} onChange={(e) => setNote(e.target.value)} /></Field>
        {error && <p className="rs-error" role="alert">{error}</p>}
        <Button variant="primary" disabled={busy || Number(qty) <= 0} onClick={submit}>{busy ? 'Registro…' : mode === 'out' ? 'Registra prelievo' : 'Registra carico'}</Button>
      </div>
      <div className="rs-inventory-history">
        <h3>Ultimi movimenti</h3>
        {movements.length === 0 ? <p className="rs-field__hint">Nessun movimento registrato.</p> : movements.map((m) => (
          <div className="rs-inventory-movement" key={m.id}>
            <span className={m.delta > 0 ? 'in' : 'out'}>{m.delta > 0 ? '+' : ''}{fmt(m.delta)} {item.unit}</span>
            <div><strong>{fmt(m.before)} → {fmt(m.after)}</strong><small>{m.movementType}{m.note ? ` · ${m.note}` : ''}</small></div>
            <time>{new Date(m.createdAt).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}</time>
          </div>
        ))}
      </div>
    </Sheet>
  )
}

export default function InventoryView({ user, hotel }) {
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [lowOnly, setLowOnly] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const canCreate = canUser(user, 'inventory', 'create')
  const canEdit = canUser(user, 'inventory', 'edit')

  const reload = async () => {
    try {
      const [nextItems, nextCategories] = await Promise.all([fetchInventoryItems(hotel.id), fetchInventoryCategories(hotel.id)])
      setItems(nextItems); setCategories(nextCategories)
    } finally { setLoading(false) }
  }
  useEffect(() => {
    setLoading(true); reload()
    const unsubscribe = subscribeInventory(hotel.id, reload)
    return () => unsubscribe?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotel.id])

  const categoryOptions = useMemo(() => flattenInventoryTree(categories), [categories])
  const lowCount = useMemo(() => items.filter((i) => inventoryStockStatus(i) !== 'ok').length, [items])
  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('it')
    return items.filter((i) => (category === 'all' || i.categoryId === category) && (!lowOnly || inventoryStockStatus(i) !== 'ok') && (!q || inventorySearchText(i).includes(q)))
  }, [items, search, category, lowOnly])
  const selected = items.find((i) => i.id === selectedId) || null

  const create = async (draft) => { await createInventoryItem(hotel.id, draft); await reload() }
  const createCategory = async (draft) => { await createInventoryCategory(hotel.id, draft); await reload() }
  const adjust = async (id, delta, note, movementType) => { await adjustInventoryStock(id, delta, note, { movementType }); await reload() }

  return (
    <div className="rs-inventory" data-testid="inventory-view">
      <div className="rs-page-title">
        <div><h1>Magazzino</h1><p>{hotel.name}</p></div>
        {canCreate && <Button variant="primary" icon="plus" onClick={() => setNewOpen(true)}>Articolo</Button>}
      </div>

      <div className="rs-inventory-summary">
        <Card><small>ARTICOLI</small><strong>{items.length}</strong></Card>
        <Card><small>CATEGORIE</small><strong>{categories.length}</strong></Card>
        <Card className={lowCount ? 'is-low' : ''}><small>DA RIORDINARE</small><strong>{lowCount}</strong></Card>
      </div>

      <div className="rs-toolbar rs-inventory-toolbar">
        <TextInput icon="search" value={search} placeholder="Nome, codice, barcode, tag, modello…" onChange={(e) => setSearch(e.target.value)} />
        <div className="rs-inventory-toolbar-row">
          <select className="rs-select" value={category} onChange={(e) => setCategory(e.target.value)}><option value="all">Tutte le categorie</option>{categoryOptions.map((c) => <option key={c.id} value={c.id}>{`${'— '.repeat(c.depth)}${c.name}`}</option>)}</select>
          <button type="button" className={`rs-chip ${lowOnly ? 'active high' : ''}`} onClick={() => setLowOnly((v) => !v)}><Icon name="warning" /> Da riordinare{lowCount ? ` · ${lowCount}` : ''}</button>
          {canCreate && <button type="button" className="rs-chip" onClick={() => setCategoryOpen(true)}><Icon name="plus" /> Categoria</button>}
        </div>
      </div>

      {loading ? <Spinner label="Carico il magazzino…" /> : filtered.length === 0 ? <EmptyState icon="package" title="Magazzino vuoto">{items.length ? 'Nessun articolo corrisponde ai filtri.' : 'Aggiungi il primo articolo del magazzino.'}</EmptyState> : (
        <div className="rs-inventory-list">
          {filtered.map((item) => {
            const status = inventoryStockStatus(item)
            return (
              <Card as="button" className={`rs-inventory-item ${status !== 'ok' ? 'is-low' : ''}`} key={item.id} onClick={() => canEdit && setSelectedId(item.id)}>
                <InventoryPhoto path={item.photoPath} className="rs-inventory-item__photo" />
                <span className="rs-inventory-item__main"><span className="rs-inventory-item__top"><strong>{item.name}</strong>{status !== 'ok' && <Badge tone="high">{status === 'esaurito' ? 'Esaurito' : 'Scorta bassa'}</Badge>}</span><small>{item.category}{item.variantLabel ? ` · ${item.variantLabel}` : ''}{item.location ? ` · ${item.location}` : ''}</small></span>
                <span className="rs-inventory-item__qty"><strong>{fmt(item.quantity)}</strong><small>{item.unit}</small></span>
                {canEdit && <Icon name="chevronRight" />}
              </Card>
            )
          })}
        </div>
      )}

      <NewItemSheet open={newOpen} categories={categories} onClose={() => setNewOpen(false)} onSave={create} onNewCategory={() => setCategoryOpen(true)} />
      <CategorySheet open={categoryOpen} categories={categories} onClose={() => setCategoryOpen(false)} onSave={createCategory} />
      <StockSheet item={selected} open={Boolean(selected)} onClose={() => setSelectedId(null)} onAdjusted={adjust} />
    </div>
  )
}
