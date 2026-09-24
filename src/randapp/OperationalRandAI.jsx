import { useEffect, useMemo, useState } from 'react'
import { retrieveRandAIGuidance } from '../randai/randai-data.js'
import { createInterventionContextEnvelope } from '../randai/context/envelope.js'
import './randai-suggestion.css'

function interventionQuery(item) {
  return [item?.location, item?.category, item?.notes].filter(Boolean).join(' · ')
}

export default function OperationalRandAI({ hotelId, user, intervention, parts = [] }) {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState({ loading: false, guidance: null, error: '' })

  const context = useMemo(() => createInterventionContextEnvelope({
    hotelId,
    intervention,
    actor: user ? {
      userId: user.auth_user_id || user.id,
      legacyId: user.legacy_id,
      role: user.role,
      department: user.department,
    } : null,
    parts,
  }), [hotelId, intervention, user, parts])

  const query = useMemo(() => interventionQuery(intervention), [intervention?.location, intervention?.category, intervention?.notes])

  useEffect(() => {
    if (!open || !query) return undefined
    let cancelled = false
    setState({ loading: true, guidance: null, error: '' })
    retrieveRandAIGuidance({ hotelId, query, operationalContext: context })
      .then((guidance) => { if (!cancelled) setState({ loading: false, guidance, error: '' }) })
      .catch(() => { if (!cancelled) setState({ loading: false, guidance: null, error: 'RandAI non è disponibile in questo momento.' }) })
    return () => { cancelled = true }
  }, [open, hotelId, query, context])

  const guidance = state.guidance
  const checks = Array.isArray(guidance?.nextChecks) ? guidance.nextChecks.slice(0, 4) : []
  const procedure = guidance?.procedure || null
  const similar = [...(guidance?.memory || []), ...(guidance?.history || [])].slice(0, 3)

  return (
    <section className="rs-randai-suggestion rs-randai-presence" aria-label="RandAI per questo intervento" data-testid="randai-intervention-presence">
      <div className="rs-randai-suggestion__head">
        <img src="/icons/randai-cat.webp" alt="" aria-hidden="true" />
        <div className="rs-randai-workspace__title">
          <strong>RandAI</strong>
          <small>Posso leggere questo intervento e i ricambi collegati</small>
        </div>
        <button type="button" className="rs-randai-workspace__toggle" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
          {open ? 'Riduci' : 'Chiedi a RandAI'}
        </button>
      </div>

      {open && (
        <div className="rs-randai-workspace__body" data-testid="randai-intervention-body">
          {state.loading && <p className="rs-randai-suggestion__muted">Analizzo intervento e contesto disponibile…</p>}
          {state.error && <small className="rs-randai-action-error" role="alert">{state.error}</small>}
          {!state.loading && !state.error && guidance && (
            <div className="rs-randai-pane">
              <strong>{guidance.headline || (guidance.found ? 'Indicazioni contestuali' : 'Conoscenza insufficiente')}</strong>
              {checks.length > 0 && <ol className="rs-randai-procedure">{checks.map((check, index) => <li key={index}>{check}</li>)}</ol>}
              {procedure && <div className="rs-randai-context-block"><small>Procedura verificata</small><b>{procedure.title}</b>{procedure.summary && <p>{procedure.summary}</p>}</div>}
              {similar.length > 0 && <div className="rs-randai-similar"><strong>Casi utili</strong>{similar.map((item, index) => <article key={item.id || index}><b>{item.solution || item.location || item.category || 'Caso precedente'}</b>{item.text && <span>{item.text}</span>}</article>)}</div>}
              {!guidance.found && checks.length === 0 && <p className="rs-randai-suggestion__muted">Non ci sono elementi verificati sufficienti. RandAI non improvvisa.</p>}
              <small className="rs-randai-suggestion__source">Solo lettura: RandAI non modifica questo intervento da qui.</small>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
