import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchIssues, subscribeIssues } from '../../issues-data.js'
import { fetchPlanned, subscribePlanned } from '../../planned-data.js'
import { Spinner } from '../ui.jsx'
import { Grid, PageTitle, Stack } from '../randui/visual-primitives.jsx'
import HubChoice from './HubChoice.jsx'
import { interventionPreviewMetrics, issuePreviewMetrics } from './hub-preview-stats.js'

export default function OperationsHub({ hotel, canIssues, canInterventions, onOpen }) {
  const [issues, setIssues] = useState([])
  const [planned, setPlanned] = useState([])
  const [loading, setLoading] = useState(Boolean(canIssues || canInterventions))

  const load = useCallback(async () => {
    if (!hotel?.id || (!canIssues && !canInterventions)) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [issuesRes, plannedRes] = await Promise.all([
        canIssues ? fetchIssues(hotel.id) : Promise.resolve({ issues: [] }),
        canInterventions ? fetchPlanned(hotel.id) : Promise.resolve({ items: [] }),
      ])
      setIssues(issuesRes.issues || issuesRes.items || [])
      setPlanned(plannedRes.items || [])
    } catch (error) {
      console.warn('Anteprima Operatività non disponibile', error)
      setIssues([])
      setPlanned([])
    } finally {
      setLoading(false)
    }
  }, [hotel?.id, canIssues, canInterventions])

  useEffect(() => {
    load()
    const offs = []
    if (canIssues && hotel?.id) offs.push(subscribeIssues(hotel.id, load))
    if (canInterventions && hotel?.id) offs.push(subscribePlanned(hotel.id, load))
    return () => offs.forEach((off) => off?.())
  }, [hotel?.id, canIssues, canInterventions, load])

  const issueMetrics = useMemo(() => issuePreviewMetrics(issues), [issues])
  const interventionMetrics = useMemo(() => interventionPreviewMetrics(planned), [planned])
  const columns = canIssues && canInterventions ? 2 : 1

  return (
    <Stack gap="sm" className="rs-operations-hub rs-ops-surface" data-testid="operations-hub">
      <PageTitle
        title="Operatività"
        subtitle="Segnalazioni e interventi adesso."
      />
      {loading ? (
        <Spinner label="Carico anteprima…" />
      ) : (
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
      )}
      <p className="rs-telegram-hint">Tap sulla card per aprire l’elenco completo. I tre numeri sono solo anteprima.</p>
    </Stack>
  )
}
