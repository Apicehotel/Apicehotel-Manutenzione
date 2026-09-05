import { useCallback, useEffect, useMemo, useState } from 'react'
import { canUser } from '../permissions.js'
import {
  fetchOperationalFloorContexts,
  floorContextId,
  loadOperationalFloorContext,
  saveOperationalFloorContext,
} from '../operational-context.js'
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

const requestContextLabel = (request) => {
  if (!request?.floor_label) return ''
  return [request.area_label, request.floor_label].filter(Boolean).join(' · ')
}

function FloorContextSelector({ contexts, value, onChange, loading = false }) {
  const areas = useMemo(() => {
    const map = new Map()
    contexts.forEach((context) => {
      if (!map.has(context.area_code)) map.set(context.area_code, { code: context.area_code, label: context.area_label, floors: [] })
      map.get(context.area_code).floors.push(context)
    })
    return Array.from(map.values())
  }, [contexts])
  const [editing, setEditing] = useState(!value)
  const [areaCode, setAreaCode] = useState(value?.area_code || areas[0]?.code || '')

  useEffect(() => {
    if (value?.area_code) setAreaCode(value.area_code)
    else if (!areaCode && areas[0]?.code) setAreaCode(areas[0].code)
    if (!value) setEditing(true)
  }, [value, areas, areaCode])

  if (loading) return <div className="rs-floor-context is-loading">Carico i piani…</div>
  if (!contexts.length) return null

  if (value && !editing) {
    return (
      <div className="rs-floor-context rs-floor-context--active" data-testid="supply-active-floor">
        <span><small>Consegna a</small><b>{value.area_label} · {value.floor_label}</b></span>
        {contexts.length > 1 && <button type="button" onClick={() => setEditing(true)}>Cambia piano</button>}
      </div>
    )
  }

  const selectedArea = areas.find((area) => area.code === areaCode) || areas[0]
  const chooseArea = (code) => {
    setAreaCode(code)
    if (value?.area_code !== code) onChange(null)
    const area = areas.find((candidate) => candidate.code === code)
    if (area?.floors.length === 1) {
      onChange(area.floors[0])
      setEditing(false)
    }
  }
  const chooseFloor = (context) => {
    onChange(context)
    setEditing(false)
  }

  return (
    <section className="rs-floor-context" aria-label="Area e piano di consegna">
      <div className="rs-floor-context__title"><b>Dove serve?</b><small>Il piano resta selezionato finché non lo cambi.</small></div>
      {areas.length > 1 && (
        <div className="rs-area-tabs" role="group" aria-label="Area">
          {areas.map((area) => (
            <button key={area.code} type="button" className={selectedArea?.code === area.code ? 'selected' : ''} onClick={() => chooseArea(area.code)}>
              {area.label}
            </button>
          ))}
        </div>
      )}
      <div className="rs-floor-tabs" role="group" aria-label="Piano">
        {(selectedArea?.floors || []).map((context) => (
          <button
            key={floorContextId(context)}
            type="button"
            className={floorContextId(value) === floorContextId(context) ? 'selected' : ''}
            onClick={() => chooseFloor(context)}
          >
            P{context.floor_number}
          </button>
        ))}
      </div>
    </section>
  )
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

function RequestComposer({ hotel, products, floorContexts, floorContext, onFloorContextChange, contextLoading, onCreated }) {
  const activeProducts = products.filter((product) => product.active)
  const [selected, setSelected] = useState([])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const grouped = useMemo(() => ({
    minibar: activeProducts.filter((p) => p.category === 'minibar'),
    consumo: activeProducts.filter((p) => p.category === 'consumo'),
  }), [activeProducts])
  const floorRequired = floorContexts.length > 0

  const toggle = (id) => setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id])
  const submit = async () => {
    if (floorRequired && !floorContext) { setError('Seleziona il piano di consegna'); return }
    setBusy(true); setError('')
    try {
      await createSupplyRequest({ hotelId: hotel.id, productIds: selected, note, floorContext })
      setSelected([]); setNote('')
      await onCreated()
    } catch (err) { setError(err?.message || 'Non riesco a inviare la richiesta') }
    finally { setBusy(false) }
  }

  if (!activeProducts.length) return <p className="rs-supply-muted">L’Admin non ha ancora inserito prodotti.</p>

  return (
    <section className="rs-supply-compose">
      <FloorContextSelector contexts={floorContexts} value={floorContext} onChange={onFloorContextChange} loading={contextLoading} />
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
      <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Nota facoltativa (office, indicazioni…)" maxLength={300} />
      {error && <p className="rs-supply-error">{error}</p>}
      <Button variant="primary" disabled={busy || !selected.length || contextLoading || (floorRequired && !floorContext)} onClick={submit}>{busy ? 'Invio…' : `Invia richiesta (${selected.length})`}</Button>
    </section>
  )
}

function RequestsList({ requests, canComplete, onResolve }) {
  const open = requests.filter((request) => !request.completed_at)
  const closed = requests.filter((request) => request.completed_at)
  const renderRequest = (request) => {
    const contextLabel = requestContextLabel(request)
    return (
      <article key={request.id} className={`rs-supply-request ${request.completed_at ? 'is-done' : ''}`}>
        <header>
          <div><b>{request.requested_by_name || 'Governante'}</b><small>{formatTime(request.created_at)}</small></div>
          <span>{request.completed_at ? 'Completata' : 'Aperta'}</span>
        </header>
        {contextLabel && <div className="rs-supply-destination"><Icon name="hotel" /><b>{contextLabel}</b></div>}
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
  }
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
  const [floorContexts, setFloorContexts] = useState([])
  const [floorContext, setFloorContext] = useState(null)
  const [contextLoading, setContextLoading] = useState(false)
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

  const refreshFloorContexts = useCallback(async () => {
    if (!canView || !hotel?.id) return
    setContextLoading(true)
    try {
      const rows = await fetchOperationalFloorContexts(hotel.id)
      setFloorContexts(rows)
      setFloorContext((current) => {
        const currentId = floorContextId(current)
        const stillValid = rows.find((context) => floorContextId(context) === currentId)
        return stillValid || loadOperationalFloorContext(user, hotel.id, rows)
      })
    } catch (err) {
      setFloorContexts([])
      setFloorContext(null)
      setError(err?.message || 'Piani non disponibili')
    } finally { setContextLoading(false) }
  }, [canView, hotel?.id, user?.auth_user_id, user?.authUserId, user?.id, user?.username, user?.name, user?.display_name])

  const changeFloorContext = useCallback((context) => {
    setFloorContext(context)
    if (context && hotel?.id) saveOperationalFloorContext(user, hotel.id, context)
  }, [hotel?.id, user])

  const refreshAll = useCallback(async () => {
    await Promise.all([refresh(), refreshFloorContexts()])
  }, [refresh, refreshFloorContexts])

  useEffect(() => { if (canView) refresh() }, [canView, refresh])
  useEffect(() => { if (canView) refreshFloorContexts() }, [canView, refreshFloorContexts])
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
      <header className="rs-supply-sheet__head">
        <div><h2>Rifornimenti</h2><p>Minibar e Consumo · {hotel.name}{floorContext ? ` · ${floorContext.area_label} · ${floorContext.floor_label}` : ''}</p></div>
        <button type="button" onClick={refreshAll} disabled={loading || contextLoading}>Aggiorna</button>
      </header>
      {error && <p className="rs-supply-error">{error}</p>}
      {canCreate && <RequestComposer hotel={hotel} products={products} floorContexts={floorContexts} floorContext={floorContext} onFloorContextChange={changeFloorContext} contextLoading={contextLoading} onCreated={refresh} />}
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
