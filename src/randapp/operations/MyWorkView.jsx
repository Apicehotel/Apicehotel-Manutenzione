import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchIssues, subscribeIssues } from '../../issues-data.js'
import { fetchPlanned, subscribePlanned } from '../../planned-data.js'
import { Card, EmptyState, Spinner, TextInput } from '../ui.jsx'
import { Stack } from '../randui/visual-primitives.jsx'
import { PageTitle, StatusPill, fmt, isAssignedTo } from './view-primitives.jsx'
import PlanningCountCards from '../planning/PlanningCountCards.jsx'

function WorkCard({ title, meta, status, body }) {
  return (
    <Card className="rs-card--pad rs-op-card">
      <div className="rs-op-card__head">
        <div>
          <strong>{title}</strong>
          <small>{meta}</small>
        </div>
        <StatusPill status={status} />
      </div>
      {body ? <p>{body}</p> : null}
    </Card>
  )
}

export default function MyWorkView({ hotel, user, onOpen }) {
  const [issues, setIssues] = useState([])
  const [planned, setPlanned] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [issuesRes, plannedRes] = await Promise.all([fetchIssues(hotel.id), fetchPlanned(hotel.id)])
      setIssues(issuesRes.issues || issuesRes.items || [])
      setPlanned(plannedRes.items || [])
    } catch (error) {
      console.warn('Caricamento Task fallito', error)
      setIssues([])
      setPlanned([])
    } finally {
      setLoading(false)
    }
  }, [hotel.id])

  useEffect(() => {
    load()
    const offI = subscribeIssues(hotel.id, load)
    const offP = subscribePlanned(hotel.id, load)
    return () => { offI?.(); offP?.() }
  }, [hotel.id, load])

  const name = String(user?.name || '').trim().toLowerCase()
  const myDoneIssues = useMemo(
    () => issues
      .filter((i) => i.status === 'done' && (String(i.completedBy || '').trim().toLowerCase() === name || String(i.technicianName || '').trim().toLowerCase() === name))
      .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0)),
    [issues, name],
  )
  const myPlanned = useMemo(
    () => planned.filter((p) => isAssignedTo(p, user)).sort((a, b) => (b.scheduledAt || 0) - (a.scheduledAt || 0)),
    [planned, user],
  )
  const myPlannedPending = myPlanned.filter((p) => p.status !== 'done')
  const myPlannedDone = myPlanned.filter((p) => p.status === 'done')
  const query = q.trim().toLowerCase()
  const matches = (room, text) => !query || String(room || '').toLowerCase().includes(query) || String(text || '').toLowerCase().includes(query)
  const filtPending = myPlannedPending.filter((p) => matches(p.location, p.notes))
  const filtPlannedDone = myPlannedDone.filter((p) => matches(p.location, p.notes))
  const filtIssuesDone = myDoneIssues.filter((i) => matches(i.room, i.title))
  const total = myPlannedPending.length + myPlannedDone.length + myDoneIssues.length

  return (
    <Stack gap="sm" className="rs-my-work rs-ops-surface" data-testid="my-work-view">
      <PageTitle
        eyebrow="Task"
        title="I miei lavori"
        subtitle={`${hotel.name} · ${total} totali · prima i compiti aperti`}
      />
      <div className="rs-ops-toolbar">
        <TextInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cerca per camera o testo…"
          aria-label="Cerca i miei lavori"
        />
      </div>
      {loading ? (
        <Spinner label="Carico…" />
      ) : total === 0 ? (
        <EmptyState icon="check" title="Nessun lavoro">Non hai interventi assegnati né segnalazioni completate.</EmptyState>
      ) : (
        <>
          {!!filtPending.length && (
            <section className="rs-ops-section" aria-label="Da fare">
              <p className="rs-actions-heading">Da fare / in attesa ({filtPending.length})</p>
              <div className="rs-migrated-list">
                {filtPending.map((p) => (
                  <WorkCard
                    key={p.id}
                    title={p.location || 'Intervento'}
                    meta={`${p.category || 'Manutenzione'} · ${fmt(p.scheduledAt)}`}
                    status={p.status}
                    body={p.notes}
                  />
                ))}
              </div>
            </section>
          )}
          {!!filtPlannedDone.length && (
            <section className="rs-ops-section" aria-label="Interventi completati">
              <p className="rs-actions-heading">Interventi completati ({filtPlannedDone.length})</p>
              <div className="rs-migrated-list">
                {filtPlannedDone.map((p) => (
                  <WorkCard
                    key={p.id}
                    title={p.location || 'Intervento'}
                    meta={fmt(p.completedAt)}
                    status={p.status}
                    body={p.notes}
                  />
                ))}
              </div>
            </section>
          )}
          {!!filtIssuesDone.length && (
            <section className="rs-ops-section" aria-label="Segnalazioni completate">
              <p className="rs-actions-heading">Segnalazioni completate da me ({filtIssuesDone.length})</p>
              <div className="rs-migrated-list">
                {filtIssuesDone.map((i) => (
                  <WorkCard
                    key={i.id}
                    title={i.room || 'Segnalazione'}
                    meta={`${i.category || 'Manutenzione'} · ${fmt(i.completedAt)}`}
                    status={i.status}
                    body={i.title}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
      {/* Planning stays a secondary shortcut after personal work, never between list sections. */}
      {!loading && (
        <PlanningCountCards hotel={hotel} user={user} onOpen={onOpen} className="rs-planning-counts--compact" />
      )}
    </Stack>
  )
}
