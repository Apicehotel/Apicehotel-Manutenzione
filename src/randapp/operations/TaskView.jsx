import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchUrgents, subscribeUrgents } from '../../urgents-data.js'
import { fetchReminders, subscribeReminders } from '../reminders/reminder-data.js'
import { Spinner } from '../ui.jsx'
import { Grid, PageTitle, Stack } from '../randui/visual-primitives.jsx'
import HubChoice from './HubChoice.jsx'
import { reminderPreviewMetrics, urgentPreviewMetrics } from './hub-preview-stats.js'

const SOFT_REFRESH_MS = 2500

function dateKey(value = new Date()) {
  return value.toISOString().slice(0, 10)
}

function weekdayKey(date) {
  return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][date.getDay()]
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
    return Number(item.month_day || String(item.start_date || '').slice(8, 10)) === now.getDate()
  }
  return false
}

export default function TaskView({ hotel, user, canUrgent = false, canReminders = false, onOpen }) {
  const housekeepingTaskRole = ['Governante','Capo Governante'].includes(user?.role)
  const showUrgent = housekeepingTaskRole || canUrgent
  const showReminders = housekeepingTaskRole || canReminders
  const [urgents, setUrgents] = useState([])
  const [reminders, setReminders] = useState([])
  const [loading, setLoading] = useState(true)
  const timer = useRef(0)
  const busy = useRef(false)

  const load = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    try {
      const [urgentResult, reminderResult] = await Promise.all([
        showUrgent ? fetchUrgents(hotel.id) : Promise.resolve({ items: [] }),
        showReminders ? fetchReminders(hotel.id) : Promise.resolve([]),
      ])
      setUrgents(urgentResult.items || [])
      setReminders(Array.isArray(reminderResult) ? reminderResult : reminderResult.items || [])
    } catch (error) {
      console.warn('Caricamento Task fallito', error)
    } finally {
      busy.current = false
      setLoading(false)
    }
  }, [hotel.id, showUrgent, showReminders])

  const scheduleRefresh = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      timer.current = 0
      void load()
    }, SOFT_REFRESH_MS)
  }, [load])

  useEffect(() => {
    void load()
    const offs = []
    if (showUrgent) offs.push(subscribeUrgents(hotel.id, scheduleRefresh))
    if (showReminders) offs.push(subscribeReminders(hotel.id, scheduleRefresh))
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
      offs.forEach((off) => off?.())
    }
  }, [hotel.id, showUrgent, showReminders, load, scheduleRefresh])

  const dueReminders = useMemo(
    () => reminders.filter((item) => reminderDueToday(item, user)),
    [reminders, user],
  )
  const urgentMetrics = useMemo(() => urgentPreviewMetrics(urgents), [urgents])
  const reminderMetrics = useMemo(
    () => reminderPreviewMetrics(reminders, dueReminders),
    [reminders, dueReminders],
  )

  const cards = [
    showUrgent && {
      key: 'urgent',
      icon: 'warning',
      title: 'Avvisi',
      metrics: urgentMetrics,
      onClick: () => onOpen?.('urgent'),
      testId: 'task-open-urgent',
    },
    showReminders && {
      key: 'reminders',
      icon: 'bell',
      title: 'Promemoria',
      metrics: reminderMetrics,
      onClick: () => onOpen?.('reminders'),
      testId: 'task-open-reminders',
    },
  ].filter(Boolean)

  return (
    <Stack gap="sm" className="rs-task-view rs-ops-surface" data-testid="task-view">
      <PageTitle
        eyebrow="Task"
        title="Task"
        subtitle={`${hotel.name} · promemoria e avvisi`}
      />
      {loading ? (
        <Spinner label="Carico Task…" />
      ) : (
        <Grid columns={cards.length >= 2 ? 2 : 1} gap="sm" className="rs-planning-choice-grid rs-ops-choice-grid">
          {cards.map((card) => (
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
      {!loading && cards.length > 0 && (
        <p className="rs-telegram-hint">Apri Avvisi o Promemoria per vedere il dettaglio.</p>
      )}
    </Stack>
  )
}
