import { useEffect, useMemo, useState } from 'react'
import { fetchIssues } from '../../issues-data.js'
import { fetchPlanned } from '../../planned-data.js'
import { fetchUrgents } from '../../urgents-data.js'
import { loadSession } from '../../session.js'
import { Icon, Spinner } from '../ui.jsx'
import { Grid, Metric, PageTitle, Stack, Surface } from '../randui/visual-primitives.jsx'
import './operations-hub.css'

const doneStatus = (value) => ['done', 'completata', 'completato', 'closed', 'chiusa', 'chiuso'].includes(String(value || '').toLowerCase())
const toDate = (value) => {
  if (!value) return null
  const date = typeof value === 'number' ? new Date(value) : new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date
}
const isToday = (value) => {
  const date = toDate(value)
  if (!date) return false
  const now = new Date()
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate()
}

function OperationalChoice({ icon, title, stats, onClick, testId }) {
  return (
    <button type="button" className="rs-randui-choice rs-operations-choice" onClick={onClick} data-testid={testId}>
      <div className="rs-randui-choice__head">
        <span className="rs-randui-choice__icon"><Icon name={icon} /></span>
        <strong>{title}</strong>
        <span className="rs-randui-choice__chevron">›</span>
      </div>
      <Grid columns={3} gap="xs" className="rs-randui-grid--keep-mobile">
        <Metric compact value={stats.today} label="Oggi" />
        <Metric compact value={stats.todo} label="Da fare" tone="warning" />
        <Metric compact value={stats.done} label="Fatti oggi" tone="success" />
      </Grid>
    </button>
  )
}

function OperationalOverview({ rows, onOpen }) {
  return (
    <Surface className="rs-operations-overview" data-testid="operations-overview">
      <header className="rs-operations-overview__header">
        <div><span>Oggi</span><strong>Panoramica operativa</strong></div>
        <small>{rows.length} elementi</small>
      </header>
      {rows.length ? (
        <div className="rs-operations-overview__items">
          {rows.map((row) => (
            <button key={row.id} type="button" className={`rs-operations-overview__item tone-${row.tone}`} onClick={() => onOpen(row.route)}>
              <span className="rs-operations-overview__icon"><Icon name={row.icon} /></span>
              <span className="rs-operations-overview__copy"><strong>{row.title}</strong><small>{row.meta}</small></span>
              {row.badge != null && <b>{row.badge}</b>}
              <Icon name="chevronRight" />
            </button>
          ))}
        </div>
      ) : (
        <div className="rs-operations-overview__empty"><Icon name="check" /><span><strong>Nessuna priorità aperta</strong><small>L'operatività è sotto controllo.</small></span></div>
      )}
    </Surface>
  )
}

export default function OperationsHub({ hotel = null, canIssues, canInterventions, canUrgent = false, onOpen }) {
  const hotelId = hotel?.id || loadSession()?.hotelId || null
  const [issues, setIssues] = useState([])
  const [planned, setPlanned] = useState([])
  const [urgents, setUrgents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    if (!hotelId) {
      setIssues([])
      setPlanned([])
      setUrgents([])
      setLoading(false)
      return () => { active = false }
    }
    setLoading(true)
    Promise.all([
      canIssues ? fetchIssues(hotelId) : Promise.resolve({ issues: [] }),
      canInterventions ? fetchPlanned(hotelId) : Promise.resolve({ items: [] }),
      canUrgent ? fetchUrgents(hotelId) : Promise.resolve({ items: [] }),
    ]).then(([issueResult, plannedResult, urgentResult]) => {
      if (!active) return
      setIssues(issueResult?.issues || [])
      setPlanned(plannedResult?.items || [])
      setUrgents(urgentResult?.items || [])
    }).catch((error) => {
      console.error('Operational dashboard load failed', error)
      if (active) { setIssues([]); setPlanned([]); setUrgents([]) }
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [hotelId, canIssues, canInterventions, canUrgent])

  const issueStats = useMemo(() => {
    const open = issues.filter((item) => !doneStatus(item.status))
    return {
      today: issues.filter((item) => isToday(item.createdAt || item.created_at)).length,
      todo: open.length,
      done: issues.filter((item) => doneStatus(item.status) && isToday(item.updatedAt || item.updated_at || item.closedAt || item.closed_at || item.createdAt || item.created_at)).length,
    }
  }, [issues])

  const interventionStats = useMemo(() => {
    const todayItems = planned.filter((item) => isToday(item.scheduledAt || item.scheduled_at || item.date))
    return {
      today: todayItems.length,
      todo: todayItems.filter((item) => !doneStatus(item.status)).length,
      done: todayItems.filter((item) => doneStatus(item.status)).length,
    }
  }, [planned])

  const overviewRows = useMemo(() => {
    const rows = []
    urgents.filter((item) => !doneStatus(item.status)).slice(0, 2).forEach((item) => rows.push({
      id: `urgent-${item.id}`,
      route: 'urgent',
      icon: 'warning',
      tone: 'high',
      title: item.message || item.title || item.location || 'Avviso urgente',
      meta: item.location || item.room || 'Richiede attenzione immediata',
      badge: '!',
    }))
    issues.filter((item) => !doneStatus(item.status)).sort((a, b) => {
      const score = (value) => value === 'alta' ? 3 : value === 'media' ? 2 : 1
      return score(b.urgency) - score(a.urgency)
    }).slice(0, 3).forEach((item) => rows.push({
      id: `issue-${item.id}`,
      route: 'issues',
      icon: 'issues',
      tone: item.urgency === 'alta' ? 'high' : 'normal',
      title: item.title || item.message || 'Segnalazione aperta',
      meta: item.room || item.location || 'Da gestire',
    }))
    const todayOpen = planned.filter((item) => isToday(item.scheduledAt || item.scheduled_at || item.date) && !doneStatus(item.status)).slice(0, 2)
    todayOpen.forEach((item) => rows.push({
      id: `planned-${item.id}`,
      route: 'interventions',
      icon: 'wrench',
      tone: 'normal',
      title: item.notes || item.category || 'Intervento di oggi',
      meta: item.location || 'Intervento pianificato',
    }))
    return rows.slice(0, 6)
  }, [issues, planned, urgents])

  if (loading) return <Spinner label="Preparo l'operatività…" />

  return (
    <Stack gap="sm" className="rs-operations-hub" data-testid="operations-hub">
      <PageTitle title="Operatività" subtitle="Segnalazioni, interventi e priorità di oggi." />
      <Grid columns={canIssues && canInterventions ? 2 : 1} gap="sm" className="rs-operations-widget-grid">
        {canIssues && <OperationalChoice icon="issues" title="Segnalazioni" stats={issueStats} onClick={() => onOpen('issues')} testId="operations-open-issues" />}
        {canInterventions && <OperationalChoice icon="wrench" title="Interventi" stats={interventionStats} onClick={() => onOpen('interventions')} testId="operations-open-interventions" />}
      </Grid>
      <OperationalOverview rows={overviewRows} onOpen={onOpen} />
      {canUrgent && urgents.some((item) => !doneStatus(item.status)) && (
        <button type="button" className="rs-operations-urgent-link" onClick={() => onOpen('urgent')}>
          <span><Icon name="warning" /><strong>Vedi tutti gli avvisi urgenti</strong></span><Icon name="chevronRight" />
        </button>
      )}
    </Stack>
  )
}
