import { useEffect, useMemo, useState } from 'react'
import { retrieveRandAIGuidance } from '../randai/randai-data.js'
import { buildIssueRandAISuggestion } from '../randai/issue-suggestion.js'
import { clearRandAIContextResource, createIssueContextEnvelope, publishRandAIContext } from '../randai/context/envelope.js'
import { executeRandAIAction, prepareRandAIAction, rejectRandAIAction } from '../randai/action-gateway.js'
import { canUser } from '../permissions.js'
import { loadSession } from '../session.js'
import { fetchDirectory } from '../users-data.js'
import './randai-suggestion.css'

function issueQuery(issue) {
  return [issue?.room, issue?.category, issue?.title].filter(Boolean).join(' · ')
}

function gatewayErrorLabel(error) {
  const code = error?.code || error?.message
  if (code === 'permission_denied') return 'Il ruolo attuale non può eseguire questa azione.'
  if (code === 'stale_resource') return 'La segnalazione è cambiata dopo l’anteprima. Riaprila e riprova.'
  if (code === 'action_gateway_disabled') return 'Le azioni RandAI sono temporaneamente disattivate.'
  if (code === 'approval_expired') return 'La conferma è scaduta. Prepara di nuovo l’azione.'
  return 'Azione non eseguita. Nessuna modifica è stata applicata.'
}

export default function RandAISuggestion({ issue, hotelId, user = null, onActionExecuted = null }) {
  const [state, setState] = useState({ loading: true, suggestion: null, unavailable: false })
  const [actionState, setActionState] = useState({ busy: false, plan: null, error: '', success: '' })
  const [actor, setActor] = useState(user)
  const query = useMemo(() => issueQuery(issue), [issue?.room, issue?.category, issue?.title])

  useEffect(() => {
    if (user) { setActor(user); return undefined }
    let active = true
    const session = loadSession()
    if (!session?.userId || session.hotelId !== hotelId) { setActor(null); return undefined }
    fetchDirectory(hotelId).then(({ users }) => {
      if (!active) return
      const match = (users || []).find((item) => item.auth_user_id === session.userId || item.id === session.userId || item.legacy_id === session.userId) || null
      setActor(match)
    }).catch(() => { if (active) setActor(null) })
    return () => { active = false }
  }, [user, hotelId])

  const context = useMemo(() => createIssueContextEnvelope({
    hotelId,
    issue,
    actor: actor ? {
      userId: actor.auth_user_id || actor.id,
      legacyId: actor.legacy_id,
      role: actor.role,
      department: actor.department,
    } : null,
  }), [hotelId, issue, actor])
  const canEdit = Boolean(actor && canUser(actor, 'issues', 'edit'))
  const canComplete = Boolean(actor && canUser(actor, 'issues', 'complete'))

  useEffect(() => {
    if (!context) return undefined
    publishRandAIContext(context)
    return () => { clearRandAIContextResource({ hotelId, resourceId: issue?.id }) }
  }, [context, hotelId, issue?.id])

  useEffect(() => {
    let cancelled = false
    setState({ loading: true, suggestion: null, unavailable: false })
    setActionState({ busy: false, plan: null, error: '', success: '' })

    retrieveRandAIGuidance({ hotelId, query, operationalContext: context })
      .then((guidance) => {
        if (cancelled) return
        setState({ loading: false, suggestion: buildIssueRandAISuggestion(guidance), unavailable: false })
      })
      .catch((error) => {
        console.error('RandAI issue suggestion failed', error)
        if (!cancelled) setState({ loading: false, suggestion: null, unavailable: true })
      })

    return () => { cancelled = true }
  }, [hotelId, query, context])

  const prepare = async (type, input = {}) => {
    if (actionState.busy || !issue?.id) return
    setActionState({ busy: true, plan: null, error: '', success: '' })
    try {
      const result = await prepareRandAIAction({ hotelId, type, resourceId: issue.id, input, context })
      setActionState({ busy: false, plan: result.plan, error: '', success: '' })
    } catch (error) {
      console.error('RandAI action prepare failed', error)
      setActionState({ busy: false, plan: null, error: gatewayErrorLabel(error), success: '' })
    }
  }

  const cancelPlan = async () => {
    const plan = actionState.plan
    setActionState({ busy: false, plan: null, error: '', success: '' })
    if (plan?.approval_id) rejectRandAIAction({ hotelId, approvalId: plan.approval_id }).catch(() => {})
  }

  const confirmPlan = async () => {
    const plan = actionState.plan
    if (!plan?.approval_id || actionState.busy) return
    setActionState((current) => ({ ...current, busy: true, error: '' }))
    try {
      const result = await executeRandAIAction({ hotelId, approvalId: plan.approval_id })
      setActionState({ busy: false, plan: null, error: '', success: result.replayed ? 'Azione già eseguita e verificata.' : 'Azione eseguita e verificata.' })
      onActionExecuted?.(result)
    } catch (error) {
      console.error('RandAI action execution failed', error)
      setActionState({ busy: false, plan: null, error: gatewayErrorLabel(error), success: '' })
    }
  }

  const hasActions = issue?.status !== 'done' && (canEdit || canComplete)

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

      {hasActions && !actionState.plan && (
        <div className="rs-randai-actions" data-testid="randai-action-gateway">
          <strong>Azioni controllate</strong>
          <small>RandAI prepara l’azione. Il server ricontrolla permessi, struttura e stato prima di applicarla.</small>
          {canEdit && (
            <div className="rs-randai-actions__row" aria-label="Cambia urgenza">
              {['alta', 'media', 'bassa'].filter((priority) => priority !== issue.urgency).map((priority) => (
                <button type="button" key={priority} disabled={actionState.busy} onClick={() => prepare('issue.update_priority', { priority })}>
                  Urgenza {priority}
                </button>
              ))}
            </div>
          )}
          {canComplete && <button type="button" className="rs-randai-actions__primary" disabled={actionState.busy} onClick={() => prepare('issue.mark_done')}>Prepara completamento</button>}
        </div>
      )}

      {actionState.plan && (
        <div className="rs-randai-approval" data-testid="randai-action-approval">
          <span>Conferma richiesta · rischio {actionState.plan.risk}</span>
          <strong>{actionState.plan.summary}</strong>
          <small>Nessuna modifica è stata ancora eseguita. La conferma vale solo per questa versione della segnalazione.</small>
          <div className="rs-randai-actions__row">
            <button type="button" disabled={actionState.busy} onClick={cancelPlan}>Annulla</button>
            <button type="button" className="rs-randai-actions__primary" disabled={actionState.busy} onClick={confirmPlan}>{actionState.busy ? 'Verifico…' : 'Conferma ed esegui'}</button>
          </div>
        </div>
      )}
      {actionState.error && <small className="rs-randai-action-error" role="alert">{actionState.error}</small>}
      {actionState.success && <small className="rs-randai-action-success" role="status">{actionState.success}</small>}
    </section>
  )
}
