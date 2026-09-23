import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchIssuesForHub, peekCachedIssues, subscribeIssues } from '../../issues-data.js'
import { fetchPlannedForHub, peekCachedPlanned, subscribePlanned } from '../../planned-data.js'
import { withTimeout } from '../../async-timeout.js'
import { Grid, PageTitle, Stack } from '../randui/visual-primitives.jsx'
import { Badge, Card } from '../ui.jsx'
import HubChoice from './HubChoice.jsx'
import { InterventionTags } from './view-primitives.jsx'
import { interventionPreviewMetrics, interventionTopPreview, issuePreviewMetrics, issueTopPreview } from './hub-preview-stats.js'

const SOFT_REFRESH_MS = 2500

export default function OperationsHub({ hotel, canIssues, canInterventions, onOpen }) {
  const [issues, setIssues] = useState([])
  const [planned, setPlanned] = useState([])
  const softTimer = useRef(0)

  const refresh = useCallback(async () => {
    if (!hotel?.id || (!canIssues && !canInterventions)) return
    try {
      const [issuesRes, plannedRes] = await withTimeout(Promise.all([
        canIssues ? fetchIssuesForHub(hotel.id) : Promise.resolve({ issues: [] }),
        canInterventions ? fetchPlannedForHub(hotel.id) : Promise.resolve({ items: [] }),
      ]), 20000, 'Operatività timeout')
      setIssues(issuesRes.issues || [])
      setPlanned(plannedRes.items || [])
    } catch (error) {
      console.warn('Anteprima Operatività non disponibile', error)
    }
  }, [hotel?.id, canIssues, canInterventions])

  const scheduleSoftRefresh = useCallback(() => {
    if (softTimer.current) window.clearTimeout(softTimer.current)
    softTimer.current = window.setTimeout(() => {
      softTimer.current = 0
      void refresh()
    }, SOFT_REFRESH_MS)
  }, [refresh])

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      if (!hotel?.id || (!canIssues && !canInterventions)) return
      try {
        const [cachedIssues, cachedPlanned] = await Promise.all([
          canIssues ? peekCachedIssues(hotel.id) : Promise.resolve([]),
          canInterventions ? peekCachedPlanned(hotel.id) : Promise.resolve([]),
        ])
        if (cancelled) return
        if (cachedIssues.length) setIssues(cachedIssues)
        if (cachedPlanned.length) setPlanned(cachedPlanned)
      } catch {
        /* cache miss is fine */
      }
      if (!cancelled) await refresh()
    })()

    const offs = []
    if (canIssues && hotel?.id) offs.push(subscribeIssues(hotel.id, scheduleSoftRefresh))
    if (canInterventions && hotel?.id) offs.push(subscribePlanned(hotel.id, scheduleSoftRefresh))
    return () => {
      cancelled = true
      if (softTimer.current) window.clearTimeout(softTimer.current)
      offs.forEach((off) => off?.())
    }
  }, [hotel?.id, canIssues, canInterventions, refresh, scheduleSoftRefresh])

  const issueMetrics = useMemo(() => issuePreviewMetrics(issues), [issues])
  const interventionMetrics = useMemo(() => interventionPreviewMetrics(planned), [planned])
  const topIssues = useMemo(() => issueTopPreview(issues), [issues])
  const topInterventions = useMemo(() => interventionTopPreview(planned), [planned])
  const columns = canIssues && canInterventions ? 2 : 1

  return (
    <Stack gap="sm" className="rs-operations-hub rs-ops-surface" data-testid="operations-hub">
      <PageTitle
        title="Operatività"
        subtitle="Segnalazioni e interventi adesso."
      />
      <Grid columns={columns} gap="sm" className="rs-planning-choice-grid rs-ops-choice-grid">
        {canIssues && (
          <HubChoice
            icon="issues"
            title="Segnalazioni"
            kind="issues"
            metrics={issueMetrics}
            onClick={() => onOpen('issues')}
            testId="operations-open-issues"
          />
        )}
        {canInterventions && (
          <HubChoice
            icon="wrench"
            title="Interventi"
            kind="interventions"
            metrics={interventionMetrics}
            onClick={() => onOpen('interventions')}
            testId="operations-open-interventions"
          />
        )}
      </Grid>
      <Grid columns={columns} gap="sm" data-testid="operations-top-preview">
        {canIssues && (
          <Card className="rs-card--pad" data-testid="operations-top-issues">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <strong>Top 3 Segnalazioni</strong><small>{topIssues.length} in evidenza</small>
            </div>
            {topIssues.length ? (
              <div className="rs-migrated-list">
                {topIssues.map((item) => (
                  <Card as="button" type="button" key={item.id} className="rs-card--pad rs-op-card" onClick={() => onOpen('issues', { issueId: item.id })}>
                    <div className="rs-op-card__head">
                      <div style={{ minWidth: 0, width: '100%', textAlign: 'left' }}>
                        <strong
                          style={{
                            display: '-webkit-box',
                            WebkitBoxOrient: 'vertical',
                            WebkitLineClamp: 3,
                            overflow: 'hidden',
                            textAlign: 'left',
                            lineHeight: 1.25,
                          }}
                        >
                          {item.title || item.room || 'Segnalazione'}
                        </strong>
                        <small style={{ display: 'block', textAlign: 'left', marginTop: 4 }}>{item.room || 'Segnalazione'}</small>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginTop: 10 }}>
                      <Badge tone="info">{item.category || 'Segnalazione'}</Badge>
                      <Badge tone={item.urgency === 'alta' ? 'danger' : item.status === 'waiting' ? 'warning' : 'default'}>
                        {item.urgency === 'alta' ? 'Urgente' : item.status === 'waiting' ? 'In attesa' : 'Aperta'}
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
            ) : <small>Nessuna segnalazione aperta.</small>}
          </Card>
        )}
        {canInterventions && (
          <Card className="rs-card--pad" data-testid="operations-top-interventions">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <strong>Top 3 Interventi</strong><small>{topInterventions.length} in evidenza</small>
            </div>
            {topInterventions.length ? (
              <div className="rs-migrated-list">
                {topInterventions.map((item) => (
                  <Card as="button" type="button" key={item.id} className="rs-card--pad rs-op-card" onClick={() => onOpen('interventions')}>
                    <div className="rs-op-card__head">
                      <div><strong>{item.location || item.ticketCode || 'Intervento'}</strong><small>{item.notes || 'Intervento operativo'}</small></div>
                    </div>
                    <InterventionTags item={item} />
                  </Card>
                ))}
              </div>
            ) : <small>Nessun intervento aperto.</small>}
          </Card>
        )}
      </Grid>
      <p className="rs-telegram-hint">Tap sulla card o su una riga per aprire l’elenco completo.</p>
    </Stack>
  )
}
