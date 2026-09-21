import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchIssuesForHub, peekCachedIssues } from '../../issues-data.js'
import { fetchPlannedForHub, peekCachedPlanned } from '../../planned-data.js'
import { fetchUrgents, subscribeUrgents } from '../../urgents-data.js'
import { fetchReminders, subscribeReminders } from '../reminders/reminder-data.js'
import { isToday } from '../helpers.js'
import { Card, EmptyState, Spinner, TextInput } from '../ui.jsx'
import { Grid, PageTitle, Stack } from '../randui/visual-primitives.jsx'
import { StatusPill, fmt, isAssignedTo } from './view-primitives.jsx'
import HubChoice from './HubChoice.jsx'
import { reminderPreviewMetrics, urgentPreviewMetrics } from './hub-preview-stats.js'

const SOFT_REFRESH_MS = 2500

function dateKey(value = new Date()) {
  return value.toISOString().slice(0, 10)
}
function weekdayKey(date) {
  return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][date.getDay()]
}
function monthDay(date) {
  return date.getDate()
}

function reminderDueToday(item, user, now = new Date()) {
  if (!item?.active) return false
  const roles = item.target_roles || []
  if (roles.length && user?.role && !roles.includes(user.role)) return false
  const today = dateKey(now)
  if (item.start_date && today < item.start_date) return false
  if (item.end_date && today > item.end_date) return false
  if (item.repeat_kind === 'once') return item.start_date === today
  if (item.repeat_kind === 'daily') return true
  if (item.repeat_kind === 'weekly') return (item.weekdays || []).includes(weekdayKey(now))
  if (item.repeat_kind === 'monthly') {
    return Number(item.month_day || String(item.start_date || '').slice(8, 10)) === monthDay(now)
  }
  return false
}

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

export default function MyWorkView({
  hotel,
  user,
  canUrgent = false,
  canReminders = false,
  onOpen,
}) {
  const [issues, setIssues] = useState([])
  const [planned, setPlanned] = useState([])
  const [urgents, setUrgents] = useState([])
  const [reminders, setReminders] = useState([])
  const [listLoading, setListLoading] = useState(true)
  const [q, setQ] = useState('')
  const softTimer = useRef(0)
  const softBusy = useRef(false)

  const loadAll = useCallback(async () => {
    try {
      const [issuesRes, plannedRes, urgentsRes, remindersRes] = await Promise.all([
        fetchIssuesForHub(hotel.id),
        fetchPlannedForHub(hotel.id),
        canUrgent ? fetchUrgents(hotel.id) : Promise.resolve({ items: [] }),
        canReminders ? fetchReminders(hotel.id) : Promise.resolve([]),
      ])
      setIssues(issuesRes.issues || [])
      setPlanned(plannedRes.items || [])
      setUrgents(urgentsRes.items || [])
      setReminders(Array.isArray(remindersRes) ? remindersRes : remindersRes.items || [])
    } catch (error) {
      console.warn('Caricamento Task fallito', error)
    } finally {
      setListLoading(false)
    }
  }, [hotel.id, canUrgent, canReminders])

  /** Soft refresh only Avvisi/Promemoria metrics — never blank the page. */
  const softRefreshCards = useCallback(async () => {
    if (softBusy.current) return
    softBusy.current = true
    try {
      const [urgentsRes, remindersRes] = await Promise.all([
        canUrgent ? fetchUrgents(hotel.id) : Promise.resolve({ items: [] }),
        canReminders ? fetchReminders(hotel.id) : Promise.resolve([]),
      ])
      setUrgents(urgentsRes.items || [])
      setReminders(Array.isArray(remindersRes) ? remindersRes : remindersRes.items || [])
    } catch (error) {
      console.warn('Aggiornamento anteprima Task fallito', error)
    } finally {
      softBusy.current = false
    }
  }, [hotel.id, canUrgent, canReminders])

  const scheduleSoftRefresh = useCallback(() => {
    if (softTimer.current) window.clearTimeout(softTimer.current)
    softTimer.current = window.setTimeout(() => {
      softTimer.current = 0
      void softRefreshCards()
    }, SOFT_REFRESH_MS)
  }, [softRefreshCards])

  useEffect(() => {
    let cancelled = false
    setListLoading(true)

    ;(async () => {
      try {
        const [cachedIssues, cachedPlanned] = await Promise.all([
          peekCachedIssues(hotel.id),
          peekCachedPlanned(hotel.id),
        ])
        if (cancelled) return
        if (cachedIssues.length) setIssues(cachedIssues)
        if (cachedPlanned.length) setPlanned(cachedPlanned)
        if (cachedIssues.length || cachedPlanned.length) setListLoading(false)
      } catch {
        /* cache miss is fine */
      }
      if (!cancelled) await loadAll()
    })()

    // Only card metrics listen to realtime, and only debounced — no full-page reload loop.
    const offs = []
    if (canUrgent) offs.push(subscribeUrgents(hotel.id, scheduleSoftRefresh))
    if (canReminders) offs.push(subscribeReminders(hotel.id, scheduleSoftRefresh))
    return () => {
      cancelled = true
      if (softTimer.current) window.clearTimeout(softTimer.current)
      offs.forEach((off) => off?.())
    }
  }, [hotel.id, loadAll, canUrgent, canReminders, scheduleSoftRefresh])

  const name = String(user?.name || '').trim().toLowerCase()
  const myDoneIssues = useMemo(
    () => issues
      .filter((i) => i.status === 'done' && (
        String(i.completedBy || '').trim().toLowerCase() === name
        || String(i.technicianName || '').trim().toLowerCase() === name
      ))
      .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0)),
    [issues, name],
  )
  const myPlanned = useMemo(
    () => planned.filter((p) => isAssignedTo(p, user)).sort((a, b) => (b.scheduledAt || 0) - (a.scheduledAt || 0)),
    [planned, user],
  )
  const myPlannedPending = myPlanned.filter((p) => p.status !== 'done' && p.status !== 'in_progress' && p.status !== 'waiting' && p.status !== 'tecnico')
  const myPlannedInProgress = myPlanned.filter((p) => ['in_progress', 'waiting', 'tecnico', 'da_finire'].includes(p.status))
  const myPlannedDone = myPlanned.filter((p) => p.status === 'done')

  const dueReminders = useMemo(
    () => reminders.filter((item) => reminderDueToday(item, user)),
    [reminders, user],
  )

  const query = q.trim().toLowerCase()
  const matches = (room, text) => !query
    || String(room || '').toLowerCase().includes(query)
    || String(text || '').toLowerCase().includes(query)
  const filtPending = myPlannedPending.filter((p) => matches(p.location, p.notes))
  const filtInProgress = myPlannedInProgress.filter((p) => matches(p.location, p.notes))
  const filtPlannedDone = myPlannedDone.filter((p) => matches(p.location, p.notes))
  const filtIssuesDone = myDoneIssues.filter((i) => matches(i.room, i.title))
  const total = myPlannedPending.length + myPlannedInProgress.length + myPlannedDone.length + myDoneIssues.length

  const urgentMetrics = useMemo(() => urgentPreviewMetrics(urgents), [urgents])
  const reminderMetrics = useMemo(
    () => reminderPreviewMetrics(reminders, dueReminders),
    [reminders, dueReminders],
  )

  const previewCards = [
    canUrgent && {
      key: 'urgent',
      icon: 'warning',
      title: 'Avvisi',
      metrics: urgentMetrics,
      onClick: () => onOpen?.('urgent'),
      testId: 'task-open-urgent',
    },
    canReminders && {
      key: 'reminders',
      icon: 'bell',
      title: 'Promemoria',
      metrics: reminderMetrics,
      onClick: () => onOpen?.('reminders'),
      testId: 'task-open-reminders',
    },
  ].filter(Boolean)

  const previewColumns = previewCards.length >= 2 ? 2 : 1

  return (
    <Stack gap="sm" className="rs-my-work rs-ops-surface" data-testid="my-work-view">
      <PageTitle
        eyebrow="Task"
        title="Task"
        subtitle={`${hotel.name} · avvisi, promemoria e i tuoi lavori`}
      />
      {previewCards.length > 0 && (
        <Grid columns={previewColumns} gap="sm" className="rs-planning-choice-grid rs-ops-choice-grid">
          {previewCards.map((card) => (
            <HubChoice
              key={card.key}
              icon={card.icon}
              title={card.title}
              kind={card.key}
              metrics={card.metrics}
              onClick={card.onClick}
              testId={card.testId}
            />
          ))}
        </Grid>
      )}
      {previewCards.length > 0 && (
        <p className="rs-telegram-hint">Tap sulla card per aprire l’elenco completo. Sotto restano i tuoi lavori.</p>
      )}

      <Stack gap="sm" className="rs-task-my-work" data-testid="task-my-work-section">
        <p className="rs-actions-heading">I miei lavori</p>
        <div className="rs-ops-toolbar">
          <TextInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cerca per camera o testo…"
            aria-label="Cerca i miei lavori"
          />
        </div>
        {listLoading ? (
          <Spinner label="Carico i tuoi lavori…" />
        ) : total === 0 ? (
          <EmptyState icon="check" title="Nessun lavoro">Non hai interventi assegnati né segnalazioni completate.</EmptyState>
        ) : (
          <>
            {!!filtPending.length && (
              <section className="rs-ops-section" aria-label="Da fare">
                <p className="rs-actions-heading">Da fare ({filtPending.length})</p>
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
            {!!filtInProgress.length && (
              <section className="rs-ops-section" aria-label="In corso">
                <p className="rs-actions-heading">In corso ({filtInProgress.length})</p>
                <div className="rs-migrated-list">
                  {filtInProgress.map((p) => (
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
      </Stack>
    </Stack>
  )
}
