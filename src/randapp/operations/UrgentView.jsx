import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchUrgents, updateUrgentRow, subscribeUrgents, linkUrgentToIssue } from '../../urgents-data.js'
import { insertIssue } from '../../issues-data.js'
import { Button, Card, EmptyState, Field, IconButton, Spinner, TextInput } from '../ui.jsx'
import ListFetchNotice from '../ListFetchNotice.jsx'
import { canSendUrgent, ISSUE_CATEGORIES, URGENCY_META } from '../helpers.js'
import { PageTitle, StatusPill, fmt } from './view-primitives.jsx'

const STATUS_RANK = { aperta: 0, presa_in_carico: 1, completata: 2 }

function sortUrgents(items) {
  return [...items].sort((a, b) => {
    const rank = (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9)
    if (rank) return rank
    return Number(b.createdAt || 0) - Number(a.createdAt || 0)
  })
}

export default function UrgentView({ hotel, user }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetchOk, setFetchOk] = useState(true)
  const [fetchOffline, setFetchOffline] = useState(false)
  const [transforming, setTransforming] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await fetchUrgents(hotel.id)
      setItems(result.items || [])
      setFetchOk(result.ok !== false)
      setFetchOffline(Boolean(result.offline))
    } catch (error) {
      console.warn('Caricamento avvisi urgenti fallito', error)
      setFetchOk(false)
      setFetchOffline(typeof navigator !== 'undefined' ? !navigator.onLine : false)
    } finally {
      setLoading(false)
    }
  }, [hotel.id])

  useEffect(() => {
    load()
    return subscribeUrgents(hotel.id, load)
  }, [hotel.id, load])

  const ordered = useMemo(() => sortUrgents(items), [items])
  const activeCount = useMemo(() => items.filter((item) => item.status !== 'completata').length, [items])

  const take = async (item) => {
    await updateUrgentRow(item.id, { hotelId: hotel.id, status: 'presa_in_carico', takenBy: user?.name })
    load()
  }
  const done = async (item) => {
    await updateUrgentRow(item.id, { hotelId: hotel.id, status: 'completata', completedBy: user?.name })
    load()
  }

  if (transforming) {
    return (
      <TransformUrgentForm
        urgent={transforming}
        hotel={hotel}
        user={user}
        onCancel={() => setTransforming(null)}
        onDone={() => { setTransforming(null); load() }}
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
            onRetry={load}
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
                    {item.status === 'aperta' && (
                      <Button variant="outline" onClick={() => take(item)}>Prendi in carico</Button>
                    )}
                    {item.status === 'presa_in_carico' && (
                      <Button icon="check" onClick={() => done(item)}>Completa</Button>
                    )}
                    {canSendUrgent(user) && item.status !== 'completata' && !item.transformed && (
                      <Button variant="ghost" icon="issues" onClick={() => setTransforming(item)}>
                        Trasforma in segnalazione
                      </Button>
                    )}
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
