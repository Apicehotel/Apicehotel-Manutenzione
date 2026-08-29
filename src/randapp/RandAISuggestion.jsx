import { useEffect, useMemo, useState } from 'react'
import { retrieveRandAIGuidance } from '../randai/randai-data.js'
import { buildIssueRandAISuggestion } from '../randai/issue-suggestion.js'
import './randai-suggestion.css'

function issueQuery(issue) {
  return [issue?.room, issue?.category, issue?.title].filter(Boolean).join(' · ')
}

export default function RandAISuggestion({ issue, hotelId }) {
  const [state, setState] = useState({ loading: true, suggestion: null, unavailable: false })
  const query = useMemo(() => issueQuery(issue), [issue?.room, issue?.category, issue?.title])

  useEffect(() => {
    let cancelled = false
    setState({ loading: true, suggestion: null, unavailable: false })

    retrieveRandAIGuidance({ hotelId, query })
      .then((guidance) => {
        if (cancelled) return
        setState({ loading: false, suggestion: buildIssueRandAISuggestion(guidance), unavailable: false })
      })
      .catch((error) => {
        console.error('RandAI issue suggestion failed', error)
        if (!cancelled) setState({ loading: false, suggestion: null, unavailable: true })
      })

    return () => { cancelled = true }
  }, [hotelId, query])

  return (
    <section className="rs-randai-suggestion" aria-label="Suggerimento RandAI" data-testid="randai-issue-suggestion">
      <div className="rs-randai-suggestion__head">
        <img src="/icons/randai-cat.webp" alt="" aria-hidden="true" />
        <div><strong>Suggerimento RandAI</strong><small>Supporto alla diagnosi · verifica prima di intervenire</small></div>
      </div>
      {state.loading ? (
        <p className="rs-randai-suggestion__muted">Analizzo segnalazione, impianto e dati disponibili…</p>
      ) : state.suggestion ? (
        <>
          <p>{state.suggestion.text}</p>
          {state.suggestion.detail && <small className="rs-randai-suggestion__detail">{state.suggestion.detail}</small>}
          {state.suggestion.caution && <small className="rs-randai-suggestion__caution">{state.suggestion.caution}</small>}
          <small className="rs-randai-suggestion__source">Fonte: {state.suggestion.source}</small>
        </>
      ) : (
        <p className="rs-randai-suggestion__muted">{state.unavailable ? 'RandAI non è disponibile in questo momento.' : 'Nessun suggerimento affidabile disponibile per questa segnalazione. RandAI non improvvisa.'}</p>
      )}
    </section>
  )
}
