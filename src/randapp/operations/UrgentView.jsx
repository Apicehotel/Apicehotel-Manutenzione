import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchUrgents, peekCachedUrgents, updateUrgentRow, subscribeUrgents, linkUrgentToIssue } from '../../urgents-data.js'
import { insertIssue } from '../../issues-data.js'
import { withTimeout } from '../../async-timeout.js'
import { Button, Card, EmptyState, Field, IconButton, Spinner, TextInput } from '../ui.jsx'
import ListFetchNotice from '../ListFetchNotice.jsx'
import { putViewCache, takeViewCache } from '../view-session-cache.js'
import { canSendUrgent, ISSUE_CATEGORIES, URGENCY_META } from '../helpers.js'
import { PageTitle, StatusPill, fmt } from './view-primitives.jsx'
import TaskResourceDetail from '../TaskResourceDetail.jsx'

const STATUS_RANK = { aperta: 0, presa_in_carico: 1, completata: 2 }

function sortUrgents(items) {
  return [...items].sort((a, b) => {
    const rank = (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9)
    if (rank) return rank
    return Number(b.createdAt || 0) - Number(a.createdAt || 0)
  })
}

export default function UrgentView({ hotel, user, onDetailChange }) {
  const cacheKey = `urgent:${hotel.id}`
  const warm = takeViewCache(cacheKey)
  const [items, setItems] = useState(() => (Array.isArray(warm) ? warm : []))
  const [loading, setLoading] = useState(() => !(Array.isArray(warm) && warm.length))
  const [fetchOk, setFetchOk] = useState(true)
  const [fetchOffline, setFetchOffline] = useState(false)
  const [transforming, setTransforming] = useState(null)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    onDetailChange?.(selected ? { kind: 'task', id: `urgent:${selected.id}` } : null)
    return () => onDetailChange?.(null)
  }, [selected?.id, onDetailChange])

  const load = useCallback(async ({ soft = false } = {}) => {
    if (!soft) setLoading(true)
    try {
      const result = await withTimeout(fetchUrgents(hotel.id), 20000, 'Avvisi timeout')
      const next = result.items || []
      setItems(next)
      putViewCache(cacheKey, next)
      setFetchOk(result.ok !== false)
      setFetchOffline(Boolean(result.offline))
    } catch (error) {
      console.warn('Caricamento avvisi urgenti fallito', error)
      setFetchOk(false)
      setFetchOffline(typeof navigator !== 'undefined' ? !navigator.onLine : false)
    } finally {
      setLoading(false)
    }
  }, [hotel.id, cacheKey])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const sessionWarm = takeViewCache(cacheKey)
      if (Array.isArray(sessionWarm) && sessionWarm.length) {
        setItems(sessionWarm)
        setLoading(false)
      } else {
        try {
          const cached = await peekCachedUrgents(hotel.id)
          if (cancelled) return
          if (cached.length) {
            setItems(cached)
            putViewCache(cacheKey, cached)
            setLoading(false)
          }
        } catch {
          /* cache miss is fine */
        }
      }
      if (!cancelled) await load({ soft: true })
    })()
    const unsub = subscribeUrgents(hotel.id, () => { void load({ soft: true }) })
    return () => {
      cancelled = true
      unsub?.()
    }
  }, [hotel.id, cacheKey, load])

  const ordered = useMemo(() => sortUrgents(items), [items])
  const activeCount = useMemo(() => items.filter((item) => item.status !== 'completata').length, [items])

  const take = async (item) => {
    await updateUrgentRow(item.id, { hotelId: hotel.id, status: 'presa_in_carico', takenBy: user?.name })
    load({ soft: true })
  }
  const done = async (item) => {
    await updateUrgentRow(item.id, { hotelId: hotel.id, status: 'completata', completedBy: user?.name })
    load({ soft: true })
  }

  if (selected) {
    return <TaskResourceDetail
      type="urgent"
      item={selected}
      hotel={hotel}
      onBack={() => setSelected(null)}
      onTake={take}
      onComplete={done}
      onTransformUrgent={(item) => { setSelected(null); setTransforming(item) }}
    />
  }

  if (transforming) {
    return (
      <TransformUrgentForm
        urgent={transforming}
        hotel={hotel}
        user={user}
        onCancel={() => setTransforming(null)}
        onDone={() => { setTransforming(null); load({ soft: true }) }}
      />
    )
  }

  const showEmpty = !loading && !(!fetchOk && !items.length) && !items.length

  return (
    <div data-testid="urgent-view" className="rs-ops-surface">
      <PageTitle title="Avvisi urgenti" subtitle={`${hotel.name} · ${activeCount} attivi`} />
      {loading ? (
        <Spinner label="Carico avvisi…" />
      ) : (
        <>
          <ListFetchNotice
            ok={fetchOk}
            offline={fetchOffline}
            hasItems={items.length > 0}
            onRetry={() => load({ soft: true })}
            resourceLabel="lista avvisi"
          />
          {showEmpty ? (
            <EmptyState icon="warning" title="Nessun avviso urgente">
              La struttura non ha avvisi attivi.
            </EmptyState>
          ) : null}
          {ordered.length ? (
            <div className="rs-migrated-list">
              {ordered.map((item) => (
                <Card key={item.id} className="rs-card--pad rs-op-card" data-urgent-status={item.status}>
                  <div className="rs-op-card__head">
                    <div>
                      <StatusPill status={item.status} />
                      <strong>{item.location || 'Avviso urgente'}</strong>
                      <small>{fmt(item.createdAt)} · {item.createdBy || '—'}</small>
                    </div>
                  </div>
                  <p>{item.note}</p>
                  {item.transformedIssueId && (
                    <small className="rs-success">✓ Trasformato in segnalazione</small>
                  )}
                  <div className="rs-op-card__actions">
                    <Button variant="ghost" onClick={() => setSelected(item)}>Apri avviso</Button>
                  </div>
                </Card>
              ))}
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

function TransformUrgentForm({ urgent, hotel, user, onCancel, onDone }) {
  const [location, setLocation] = useState('')
  const [category, setCategory] = useState(ISSUE_CATEGORIES[0])
  const [urgency, setUrgency] = useState('alta')
  const [note, setNote] = useState(urgent.note || '')
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!location.trim() || !note.trim() || saving) return
    setSaving(true)
    try {
      const issue = await insertIssue({
        hotelId: hotel.id,
        room: location.trim(),
        category,
        urgency,
        title: note.trim(),
        status: 'todo',
        createdAt: Date.now(),
        createdByName: user?.name || 'App',
        origin: 'App',
      })
      await linkUrgentToIssue(urgent.id, hotel.id, issue.id, user?.name)
      onDone()
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="rs-form" onSubmit={submit} data-testid="transform-urgent-form">
      <div className="rs-form__head">
        <IconButton icon="chevronLeft" label="Indietro" onClick={onCancel} />
        <div>
          <h2>Trasforma in segnalazione</h2>
          <p>{hotel.name}</p>
        </div>
      </div>
      <div className="rs-note rs-note--waiting">
        Richiesta urgente originale, da <strong>{urgent.createdBy}</strong>: “{urgent.note}”
        <br />
        Verrà segnata come gestita e collegata alla nuova segnalazione.
      </div>
      <Field label="Camera o zona">
        <TextInput
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Es. Camera 214 o Hall"
          required
          autoFocus
        />
      </Field>
      <fieldset className="rs-fieldset">
        <legend>Categoria</legend>
        <div className="rs-chips">
          {ISSUE_CATEGORIES.map((item) => (
            <button
              type="button"
              key={item}
              className={`rs-chip ${category === item ? 'active' : ''}`}
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="rs-fieldset">
        <legend>Urgenza</legend>
        <div className="rs-chips">
          {Object.entries(URGENCY_META).map(([k, v]) => (
            <button
              type="button"
              key={k}
              className={`rs-chip ${urgency === k ? 'active' : ''}`}
              onClick={() => setUrgency(k)}
            >
              {v.label}
            </button>
          ))}
        </div>
      </fieldset>
      <Field label="Note">
        <textarea className="rs-textarea" rows="4" value={note} onChange={(e) => setNote(e.target.value)} required />
      </Field>
      <div className="rs-form-actions">
        <Button type="button" variant="ghost" onClick={onCancel}>Annulla</Button>
        <Button variant="primary" icon="plus" disabled={!location.trim() || !note.trim() || saving}>
          {saving ? 'Creo…' : 'Crea segnalazione e chiudi urgenza'}
        </Button>
      </div>
    </form>
  )
}
