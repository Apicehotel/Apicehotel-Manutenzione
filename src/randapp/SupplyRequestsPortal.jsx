import { useCallback, useEffect, useMemo, useState } from 'react'
import { canUser } from '../permissions.js'
import {
  createSupplyRequest,
  deleteSupplyProduct,
  fetchSupplyProducts,
  fetchSupplyRequests,
  resolveSupplyItem,
  saveSupplyProduct,
  subscribeSupplyRequests,
} from '../supply-data.js'
import { Button, Icon, Sheet } from './ui.jsx'
import './supply-requests.css'

const CATEGORY_LABEL = { minibar: 'Minibar', consumo: 'Consumo' }
const STATUS_LABEL = { pending: 'In attesa', delivered: 'Consegnato', missing: 'Manca' }
const VIEW_ROLES = new Set(['Governante', 'Capo Governante', 'manutentore', 'admin'])
const CREATE_ROLES = new Set(['Governante', 'Capo Governante', 'admin'])
const COMPLETE_ROLES = new Set(['manutentore', 'admin'])

const formatTime = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function ProductManager({ hotel, products, onChanged }) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('minibar')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const add = async (event) => {
    event.preventDefault()
    setBusy(true); setError('')
    try {
      await saveSupplyProduct({ hotelId: hotel.id, name, category })
      setName('')
      await onChanged()
    } catch (err) { setError(err?.message || 'Errore durante il salvataggio') }
    finally { setBusy(false) }
  }

  const toggle = async (product) => {
    setBusy(true); setError('')
    try {
      await saveSupplyProduct({ hotelId: hotel.id, id: product.id, name: product.name, category: product.category, active: !product.active, sortOrder: product.sort_order })
      await onChanged()
    } catch (err) { setError(err?.message || 'Errore durante il salvataggio') }
    finally { setBusy(false) }
  }

  const remove = async (product) => {
    if (!window.confirm(`Eliminare “${product.name}”? Se è già stato usato nello storico, RandApp impedirà la cancellazione.`)) return
    setBusy(true); setError('')
    try { await deleteSupplyProduct(hotel.id, product.id); await onChanged() }
    catch (err) { setError(err?.message || 'Prodotto già usato: disattivalo invece di eliminarlo') }
    finally { setBusy(false) }
  }

  return (
    <section className="rs-supply-admin">
      <h3>Prodotti</h3>
      <p>Aggiungi nel tempo solo ciò che usate davvero. Le categorie disponibili sono Minibar e Consumo.</p>
      <form className="rs-supply-admin__form" onSubmit={add}>
        <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Categoria prodotto">
          <option value="minibar">Minibar</option>
          <option value="consumo">Consumo</option>
        </select>
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome prodotto" maxLength={120} />
        <Button type="submit" disabled={busy || !name.trim()}>Aggiungi</Button>
      </form>
      {error && <p className="rs-supply-error">{error}</p>}
      <div className="rs-supply-admin__list">
        {products.map((product) => (
          <div key={product.id} className={`rs-supply-admin__row ${product.active ? '' : 'is-off'}`}>
            <span><b>{product.name}</b><small>{CATEGORY_LABEL[product.category]} · {product.active ? 'Attivo' : 'Disattivato'}</small></span>
            <div>
              <button type="button" onClick={() => toggle(product)} disabled={busy}>{product.active ? 'Disattiva' : 'Riattiva'}</button>
              <button type="button" onClick={() => remove(product)} disabled={busy}>Elimina</button>
            </div>
          </div>
        ))}
        {!products.length && <p className="rs-supply-muted">Nessun prodotto ancora inserito.</p>}
      </div>
    </section>
  )
}

function RequestComposer({ hotel, products, onCreated }) {
  const activeProducts = products.filter((product) => product.active)
  const [selected, setSelected] = useState([])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const grouped = useMemo(() => ({
    minibar: activeProducts.filter((p) => p.category === 'minibar'),
    consumo: activeProducts.filter((p) => p.category === 'consumo'),
  }), [activeProducts])

  const toggle = (id) => setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id])
  const submit = async () => {
    setBusy(true); setError('')
    try {
      await createSupplyRequest({ hotelId: hotel.id, productIds: selected, note })
      setSelected([]); setNote('')
      await onCreated()
    } catch (err) { setError(err?.message || 'Non riesco a inviare la richiesta') }
    finally { setBusy(false) }
  }

  if (!activeProducts.length) return <p className="rs-supply-muted">L’Admin non ha ancora inserito prodotti.</p>

  return (
    <section className="rs-supply-compose">
      <p className="rs-supply-muted">Seleziona solo ciò che serve. Non ci sono quantità: ogni voce resta in attesa finché non viene segnata come Consegnato o Manca.</p>
      {['minibar', 'consumo'].map((category) => grouped[category].length > 0 && (
        <div key={category} className="rs-supply-category">
          <h3>{CATEGORY_LABEL[category]}</h3>
          <div className="rs-supply-product-grid">
            {grouped[category].map((product) => (
              <button key={product.id} type="button" className={selected.includes(product.id) ? 'selected' : ''} onClick={() => toggle(product.id)}>
                {selected.includes(product.id) && <Icon name="check" />} {product.name}
              </button>
            ))}
          </div>
        </div>
      ))}
      <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Nota facoltativa (piano, office, indicazioni…)" maxLength={300} />
      {error && <p className="rs-supply-error">{error}</p>}
      <Button variant="primary" disabled={busy || !selected.length} onClick={submit}>{busy ? 'Invio…' : `Invia richiesta (${selected.length})`}</Button>
    </section>
  )
}

function RequestsList({ requests, canComplete, onResolve }) {
  const open = requests.filter((request) => !request.completed_at)
  const closed = requests.filter((request) => request.completed_at)
  const renderRequest = (request) => (
    <article key={request.id} className={`rs-supply-request ${request.completed_at ? 'is-done' : ''}`}>
      <header>
        <div><b>{request.requested_by_name || 'Governante'}</b><small>{formatTime(request.created_at)}</small></div>
        <span>{request.completed_at ? 'Completata' : 'Aperta'}</span>
      </header>
      {request.note && <p className="rs-supply-note">{request.note}</p>}
      <div className="rs-supply-items">
        {(request.supply_request_items || []).map((item) => (
          <div key={item.id} className={`rs-supply-item status-${item.status}`}>
            <span><b>{item.product_name}</b><small>{CATEGORY_LABEL[item.category]} · {STATUS_LABEL[item.status]}</small></span>
            {item.status === 'pending' && canComplete && (
              <div className="rs-supply-actions">
                <button type="button" className="deliver" onClick={() => onResolve(item.id, 'delivered')}>✓ Consegnato</button>
                <button type="button" className="missing" onClick={() => onResolve(item.id, 'missing')}>! Manca</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </article>
  )
  return (
    <section className="rs-supply-requests">
      <h3>Richieste aperte</h3>
      {open.length ? open.map(renderRequest) : <p className="rs-supply-muted">Nessuna richiesta in attesa.</p>}
      {closed.length > 0 && <details><summary>Storico recente ({closed.length})</summary>{closed.slice(0, 15).map(renderRequest)}</details>}
    </section>
  )
}

export default function SupplyRequestsPortal({ user, hotel, standalone = false }) {
  const role = user?.role
  const canView = canUser(user, 'supplies', 'view') || VIEW_ROLES.has(role)
  const canCreate = canUser(user, 'supplies', 'create') || CREATE_ROLES.has(role)
  const canComplete = canUser(user, 'supplies', 'complete') || COMPLETE_ROLES.has(role)
  const canManage = canUser(user, 'supplies', 'manage') || role === 'admin'
  const [open, setOpen] = useState(false)
  const [products, setProducts] = useState([])
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!canView || !hotel?.id) return
    setLoading(true); setError('')
    try {
      const [productRows, requestRows] = await Promise.all([
        fetchSupplyProducts(hotel.id, { includeInactive: canManage }),
        fetchSupplyRequests(hotel.id),
      ])
      setProducts(productRows); setRequests(requestRows)
    } catch (err) { setError(err?.message || 'Rifornimenti non disponibili') }
    finally { setLoading(false) }
  }, [canView, canManage, hotel?.id])

  useEffect(() => { if (canView) refresh() }, [canView, refresh])
  useEffect(() => {
    if (!canView || !hotel?.id) return undefined
    return subscribeSupplyRequests(hotel.id, refresh)
  }, [canView, hotel?.id, refresh])

  const pendingCount = useMemo(() => requests.reduce((total, request) => total + (request.supply_request_items || []).filter((item) => item.status === 'pending').length, 0), [requests])
  const resolve = async (itemId, status) => {
    setError('')
    try { await resolveSupplyItem(itemId, status); await refresh() }
    catch (err) { setError(err?.message || 'Aggiornamento non riuscito') }
  }

  if (!canView || !hotel) return null

  const content = (
    <div className="rs-supply-sheet" data-testid="supply-portal">
      <header className="rs-supply-sheet__head"><div><h2>Rifornimenti</h2><p>Minibar e Consumo · {hotel.name}</p></div><button type="button" onClick={refresh} disabled={loading}>Aggiorna</button></header>
      {error && <p className="rs-supply-error">{error}</p>}
      {canCreate && <RequestComposer hotel={hotel} products={products} onCreated={refresh} />}
      <RequestsList requests={requests} canComplete={canComplete} onResolve={resolve} />
      {canManage && <ProductManager hotel={hotel} products={products} onChanged={refresh} />}
    </div>
  )

  if (standalone) return content

  return (
    <>
      <button type="button" className="rs-supply-launcher" onClick={() => setOpen(true)} data-testid="supply-launcher">
        <Icon name="package" /><span>Rifornimenti</span>{pendingCount > 0 && <b>{pendingCount}</b>}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Rifornimenti">{content}</Sheet>
    </>
  )
}
