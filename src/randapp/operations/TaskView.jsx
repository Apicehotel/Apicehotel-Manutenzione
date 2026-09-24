import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchUrgents, peekCachedUrgents, subscribeUrgents } from '../../urgents-data.js'
import { fetchReminders, subscribeReminders } from '../reminders/reminder-data.js'
import { withTimeout } from '../../async-timeout.js'
import { Spinner } from '../ui.jsx'
import { Grid, PageTitle, Stack } from '../randui/visual-primitives.jsx'
import HubChoice from './HubChoice.jsx'
import { reminderPreviewMetrics, urgentPreviewMetrics } from './hub-preview-stats.js'
import { putViewCache, takeViewCache } from '../view-session-cache.js'

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
  const cacheKey = `task:${hotel.id}`
  const warm = takeViewCache(cacheKey)
  const [urgents, setUrgents] = useState(() => (Array.isArray(warm?.urgents) ? warm.urgents : []))
  const [reminders, setReminders] = useState(() => (Array.isArray(warm?.reminders) ? warm.reminders : []))
  const [loading, setLoading] = useState(() => !(warm && ((Array.isArray(warm.urgents) && warm.urgents.length) || (Array.isArray(warm.reminders) && warm.reminders.length))))
  const timer = useRef(0)
  const busy = useRef(false)

  const load = useCallback(async ({ soft = false } = {}) => {
    if (busy.current) return
    busy.current = true
    if (!soft) setLoading(true)
    try {
      const [urgentResult, reminderResult] = await withTimeout(Promise.all([
        showUrgent ? fetchUrgents(hotel.id) : Promise.resolve({ items: [] }),
        showReminders ? fetchReminders(hotel.id) : Promise.resolve([]),
      ]), 20000, 'Task timeout')
      const nextUrgents = urgentResult.items || []
      const nextReminders = Array.isArray(reminderResult) ? reminderResult : reminderResult.items || []
      setUrgents(nextUrgents)
      setReminders(nextReminders)
      putViewCache(cacheKey, { urgents: nextUrgents, reminders: nextReminders })
    } catch (error) {
      console.warn('Caricamento Task fallito', error)
    } finally {
      busy.current = false
      setLoading(false)
    }
  }, [hotel.id, showUrgent, showReminders, cacheKey])

  const scheduleRefresh = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      timer.current = 0
      void load({ soft: true })
    }, SOFT_REFRESH_MS)
  }, [load])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const sessionWarm = takeViewCache(cacheKey)
      if (sessionWarm && ((sessionWarm.urgents?.length) || (sessionWarm.reminders?.length))) {
        setUrgents(sessionWarm.urgents || [])
        setReminders(sessionWarm.reminders || [])
        setLoading(false)
      } else if (showUrgent) {
        try {
          const cached = await peekCachedUrgents(hotel.id)
          if (cancelled) return
          if (cached.length) {
            setUrgents(cached)
            putViewCache(cacheKey, { urgents: cached, reminders: [] })
            setLoading(false)
          }
        } catch {
          /* cache miss is fine */
        }
      }
      if (!cancelled) await load({ soft: true })
    })()
    const offs = []
    if (showUrgent) offs.push(subscribeUrgents(hotel.id, scheduleRefresh))
    if (showReminders) offs.push(subscribeReminders(hotel.id, scheduleRefresh))
    return () => {
      cancelled = true
      if (timer.current) window.clearTimeout(timer.current)
      offs.forEach((off) => off?.())
    }
  }, [hotel.id, showUrgent, showReminders, load, scheduleRefresh, cacheKey])

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
