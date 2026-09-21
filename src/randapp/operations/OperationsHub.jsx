import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchIssuesForHub, peekCachedIssues, subscribeIssues } from '../../issues-data.js'
import { fetchPlannedForHub, peekCachedPlanned, subscribePlanned } from '../../planned-data.js'
import { Grid, PageTitle, Stack } from '../randui/visual-primitives.jsx'
import HubChoice from './HubChoice.jsx'
import { interventionPreviewMetrics, issuePreviewMetrics } from './hub-preview-stats.js'

export default function OperationsHub({ hotel, canIssues, canInterventions, onOpen }) {
  const [issues, setIssues] = useState([])
  const [planned, setPlanned] = useState([])

  const refresh = useCallback(async () => {
    if (!hotel?.id || (!canIssues && !canInterventions)) return
    try {
      const [issuesRes, plannedRes] = await Promise.all([
        canIssues ? fetchIssuesForHub(hotel.id) : Promise.resolve({ issues: [] }),
        canInterventions ? fetchPlannedForHub(hotel.id) : Promise.resolve({ items: [] }),
      ])
      setIssues(issuesRes.issues || [])
      setPlanned(plannedRes.items || [])
    } catch (error) {
      console.warn('Anteprima Operatività non disponibile', error)
    }
  }, [hotel?.id, canIssues, canInterventions])

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
    if (canIssues && hotel?.id) offs.push(subscribeIssues(hotel.id, () => { void refresh() }))
    if (canInterventions && hotel?.id) offs.push(subscribePlanned(hotel.id, () => { void refresh() }))
    return () => {
      cancelled = true
      offs.forEach((off) => off?.())
    }
  }, [hotel?.id, canIssues, canInterventions, refresh])

  const issueMetrics = useMemo(() => issuePreviewMetrics(issues), [issues])
  const interventionMetrics = useMemo(() => interventionPreviewMetrics(planned), [planned])
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
      <p className="rs-telegram-hint">Tap sulla card per aprire l’elenco completo. I tre numeri sono solo anteprima.</p>
    </Stack>
  )
}
