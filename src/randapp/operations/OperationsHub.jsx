import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchIssuesForHub, peekCachedIssues, subscribeIssues } from '../../issues-data.js'
import { fetchPlannedForHub, peekCachedPlanned, subscribePlanned } from '../../planned-data.js'
import { withTimeout } from '../../async-timeout.js'
import { Icon } from '../ui.jsx'
import HubChoice from './HubChoice.jsx'
import { interventionPreviewMetrics, interventionTopPreview, issuePreviewMetrics, issueTopPreview } from './hub-preview-stats.js'
import { InterventionTags } from './view-primitives.jsx'


// Isolated Top 3 layout: prevents shared legacy button/card rules from
// reverting the mobile preview into uneven horizontal tiles.
const topPreviewStyles = {
  grid: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 10, minWidth: 0, width: '100%' },
  panel: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', alignContent: 'start', gap: 10, minWidth: 0, width: '100%', overflow: 'hidden' },
  list: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 8, minWidth: 0, width: '100%' },
  row: { display: 'grid', gridTemplateColumns: '24px minmax(0, 1fr) auto', alignItems: 'start', gap: 9, minWidth: 0, width: '100%', maxWidth: '100%', margin: 0, textAlign: 'left', whiteSpace: 'normal' },
  body: { display: 'grid', minWidth: 0, gap: 4, overflowWrap: 'anywhere', textAlign: 'left' },
  text: { display: 'block', minWidth: 0, maxWidth: '100%', whiteSpace: 'normal', overflowWrap: 'anywhere', textAlign: 'left' },
}

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
    <section className="rv2-page rv2-operations rs-ops-surface" data-testid="operations-hub">
      <header className="rv2-pagehead">
        <div><span className="rv2-eyebrow">Operatività</span><h1>Operatività</h1><p>Segnalazioni e interventi adesso.</p></div>
      </header>

      <div className="rv2-choice-grid rs-ops-choice-grid" data-columns={columns}>
        {canIssues && <HubChoice icon="issues" title="Segnalazioni" kind="issues" metrics={issueMetrics} onClick={() => onOpen('issues')} testId="operations-open-issues" />}
        {canInterventions && <HubChoice icon="wrench" title="Interventi" kind="interventions" metrics={interventionMetrics} onClick={() => onOpen('interventions')} testId="operations-open-interventions" />}
      </div>

      <div className="rv2-preview-grid rs-top3-stack" style={topPreviewStyles.grid} data-columns={columns} data-testid="operations-top-preview">
        {canIssues && (
          <section className="rv2-panel" style={topPreviewStyles.panel} data-testid="operations-top-issues">
            <div className="rv2-panel__head"><div><span>Segnalazioni</span><h2>Top 3 Segnalazioni</h2></div><small>{topIssues.length} in evidenza</small></div>
            {topIssues.length ? <div className="rv2-list" style={topPreviewStyles.list}>
              {topIssues.map((item) => (
                <button type="button" key={item.id} className="rv2-row" style={topPreviewStyles.row} onClick={() => onOpen('issues', { issueId: item.id })}>
                  <span className="rv2-row__icon"><Icon name="issues" /></span>
                  <div className="rv2-row__body" style={topPreviewStyles.body}><strong className="rv2-row__title" style={topPreviewStyles.text}>{item.title || item.room || 'Segnalazione'}</strong><small style={topPreviewStyles.text}>{item.room || item.category || 'Segnalazione'}</small></div>
                  <span className={`rv2-status ${item.urgency === 'alta' ? 'danger' : item.status === 'waiting' ? 'warning' : ''}`}>{item.urgency === 'alta' ? 'Urgente' : item.status === 'waiting' ? 'Attesa' : 'Aperta'}</span>
                </button>
              ))}
            </div> : <p className="rv2-empty">Nessuna segnalazione aperta.</p>}
            <button type="button" className="rv2-seeall" onClick={() => onOpen('issues')}>Vedi tutte le segnalazioni <Icon name="chevronRight" /></button>
          </section>
        )}

        {canInterventions && (
          <section className="rv2-panel" style={topPreviewStyles.panel} data-testid="operations-top-interventions">
            <div className="rv2-panel__head"><div><span>Interventi</span><h2>Top 3 Interventi</h2></div><small>{topInterventions.length} in evidenza</small></div>
            {topInterventions.length ? <div className="rv2-list" style={topPreviewStyles.list}>
              {topInterventions.map((item) => (
                <button type="button" key={item.id} className="rv2-row" style={topPreviewStyles.row} onClick={() => onOpen('interventions')}>
                  <span className="rv2-row__icon"><Icon name="wrench" /></span>
                  <div className="rv2-row__body" style={topPreviewStyles.body}><strong style={topPreviewStyles.text}>{item.location || item.ticketCode || 'Intervento'}</strong><small style={topPreviewStyles.text}>{item.notes || 'Intervento operativo'}</small><InterventionTags item={item} /></div>
                  <span className="rv2-status">Apri</span>
                </button>
              ))}
            </div> : <p className="rv2-empty">Nessun intervento aperto.</p>}
            <button type="button" className="rv2-seeall" onClick={() => onOpen('interventions')}>Vedi tutti gli interventi <Icon name="chevronRight" /></button>
          </section>
        )}
      </div>
    </section>
  )
}
