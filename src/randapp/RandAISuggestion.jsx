import { useEffect, useMemo, useState } from 'react'
import { retrieveRandAIGuidance } from '../randai/randai-data.js'
import { buildIssueRandAISuggestion } from '../randai/issue-suggestion.js'
import { clearRandAIContextResource, createIssueContextEnvelope, publishRandAIContext } from '../randai/context/envelope.js'
import { executeRandAIAction, prepareRandAIAction, rejectRandAIAction } from '../randai/action-gateway.js'
import { confirmIssueWorkspaceStep, getIssueWorkspace, issueWorkspaceProgress, prepareIssueCompletionSummary, startIssueWorkspace } from '../randai/issue-workspace.js'
import { canUser } from '../permissions.js'
import { loadSession } from '../session.js'
import { fetchDirectory } from '../users-data.js'
import './randai-suggestion.css'

const TABS = [['analyze', 'Analizza'], ['guide', 'Guidami'], ['procedure', 'Procedura'], ['similar', 'Casi simili']]
const issueQuery = (issue) => [issue?.room, issue?.category, issue?.title].filter(Boolean).join(' · ')

function gatewayErrorLabel(error) {
  const code = error?.code || error?.message
  if (code === 'permission_denied') return 'Il ruolo attuale non può eseguire questa azione.'
  if (code === 'stale_resource') return 'La segnalazione è cambiata dopo l’anteprima. Riaprila e riprova.'
  if (code === 'action_gateway_disabled') return 'Le azioni RandAI sono temporaneamente disattivate.'
  if (code === 'approval_expired') return 'La conferma è scaduta. Prepara di nuovo l’azione.'
  return 'Azione non eseguita. Nessuna modifica è stata applicata.'
}

function workspaceErrorLabel(error) {
  const code = error?.code || error?.message
  if (code === 'verified_procedure_required') return 'Per il percorso guidato serve una procedura verificata. RandAI non inventa passaggi operativi.'
  if (code === 'task_revision_conflict') return 'Il percorso è stato aggiornato da un’altra sessione. Ricarico lo stato corrente.'
  return 'Percorso RandAI non disponibile in questo momento.'
}

export default function RandAISuggestion({ issue, hotelId, user = null, onActionExecuted = null }) {
  const [guidanceState, setGuidanceState] = useState({ loading: true, guidance: null, unavailable: false })
  const [workspaceState, setWorkspaceState] = useState({ loading: true, task: null, busy: false, error: '', success: '' })
  const [actionState, setActionState] = useState({ busy: false, plan: null, error: '', success: '' })
  const [actor, setActor] = useState(user)
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('analyze')
  const [stepNote, setStepNote] = useState('')
  const [summaryPreview, setSummaryPreview] = useState('')
  const query = useMemo(() => issueQuery(issue), [issue?.room, issue?.category, issue?.title])

  useEffect(() => {
    if (user) { setActor(user); return undefined }
    let active = true
    const session = loadSession()
    if (!session?.userId || session.hotelId !== hotelId) { setActor(null); return undefined }
    fetchDirectory(hotelId).then(({ users }) => {
      if (!active) return
      setActor((users || []).find((item) => item.auth_user_id === session.userId || item.id === session.userId || item.legacy_id === session.userId) || null)
    }).catch(() => { if (active) setActor(null) })
    return () => { active = false }
  }, [user, hotelId])

  const context = useMemo(() => createIssueContextEnvelope({
    hotelId,
    issue,
    actor: actor ? { userId: actor.auth_user_id || actor.id, legacyId: actor.legacy_id, role: actor.role, department: actor.department } : null,
  }), [hotelId, issue, actor])
  const canEdit = Boolean(actor && canUser(actor, 'issues', 'edit'))
  const canComplete = Boolean(actor && canUser(actor, 'issues', 'complete'))

  useEffect(() => {
    if (!context) return undefined
    publishRandAIContext(context)
    return () => clearRandAIContextResource({ hotelId, resourceId: issue?.id })
  }, [context, hotelId, issue?.id])

  useEffect(() => {
    let cancelled = false
    setGuidanceState({ loading: true, guidance: null, unavailable: false })
    setWorkspaceState({ loading: true, task: null, busy: false, error: '', success: '' })
    setActionState({ busy: false, plan: null, error: '', success: '' })
    setSummaryPreview('')
    setOpen(false)
    setTab('analyze')
    Promise.allSettled([
      retrieveRandAIGuidance({ hotelId, query, operationalContext: context }),
      getIssueWorkspace({ hotelId, issueId: issue?.id }),
    ]).then(([guidanceResult, taskResult]) => {
      if (cancelled) return
      setGuidanceState(guidanceResult.status === 'fulfilled'
        ? { loading: false, guidance: guidanceResult.value, unavailable: false }
        : { loading: false, guidance: null, unavailable: true })
      setWorkspaceState({ loading: false, task: taskResult.status === 'fulfilled' ? taskResult.value : null, busy: false, error: '', success: '' })
    })
    return () => { cancelled = true }
  }, [hotelId, issue?.id, query, context])

  const guidance = guidanceState.guidance
  const suggestion = useMemo(() => buildIssueRandAISuggestion(guidance), [guidance])
  const progress = useMemo(() => issueWorkspaceProgress(workspaceState.task), [workspaceState.task])

  const startGuide = async () => {
    if (workspaceState.busy) return
    setWorkspaceState((current) => ({ ...current, busy: true, error: '', success: '' }))
    try {
      const task = await startIssueWorkspace({ hotelId, issueId: issue.id, procedureId: guidance?.procedure?.id || null })
      setWorkspaceState({ loading: false, task, busy: false, error: '', success: 'Percorso operativo avviato e salvato.' })
    } catch (error) {
      setWorkspaceState((current) => ({ ...current, busy: false, error: workspaceErrorLabel(error), success: '' }))
    }
  }

  const confirmStep = async () => {
    if (!workspaceState.task?.id || workspaceState.busy) return
    setWorkspaceState((current) => ({ ...current, busy: true, error: '', success: '' }))
    try {
      const task = await confirmIssueWorkspaceStep({ hotelId, issueId: issue.id, taskId: workspaceState.task.id, note: stepNote })
      setStepNote('')
      setWorkspaceState({ loading: false, task, busy: false, error: '', success: task?.status === 'VERIFYING' ? 'Percorso completato. Verifica il risultato reale prima di chiudere la segnalazione.' : 'Passaggio confermato e checkpoint salvato.' })
    } catch (error) {
      setWorkspaceState((current) => ({ ...current, busy: false, error: workspaceErrorLabel(error), success: '' }))
      if ((error?.code || error?.message) === 'task_revision_conflict') getIssueWorkspace({ hotelId, issueId: issue.id }).then((task) => setWorkspaceState((current) => ({ ...current, task }))).catch(() => {})
    }
  }

  const buildSummary = async () => {
    if (!workspaceState.task?.id || workspaceState.busy) return
    setWorkspaceState((current) => ({ ...current, busy: true, error: '', success: '' }))
    try {
      const summary = await prepareIssueCompletionSummary({ hotelId, issueId: issue.id, taskId: workspaceState.task.id })
      setSummaryPreview(summary)
      setWorkspaceState((current) => ({ ...current, busy: false, success: 'Riepilogo pronto. Controllalo: la chiusura passerà dal Gateway e richiederà conferma.', error: '' }))
    } catch (error) {
      setWorkspaceState((current) => ({ ...current, busy: false, error: workspaceErrorLabel(error), success: '' }))
    }
  }

  const prepare = async (type, input = {}) => {
    if (actionState.busy || !issue?.id) return
    setActionState({ busy: true, plan: null, error: '', success: '' })
    try {
      const result = await prepareRandAIAction({ hotelId, type, resourceId: issue.id, input, context })
      setActionState({ busy: false, plan: result.plan, error: '', success: '' })
    } catch (error) {
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
      setActionState({ busy: false, plan: null, error: gatewayErrorLabel(error), success: '' })
    }
  }

  const hasActions = !actionState.success && issue?.status !== 'done' && (canEdit || canComplete)
  const history = guidance?.history || []
  const memory = guidance?.memory || []

  return (
    <section className="rs-randai-suggestion rs-randai-workspace" aria-label="RandAI per questa segnalazione" data-testid="randai-issue-suggestion">
      <div className="rs-randai-suggestion__head">
        <img src="/icons/randai-cat.webp" alt="" aria-hidden="true" />
        <div className="rs-randai-workspace__title"><strong>RandAI</strong><small>{progress ? `${progress.label}${progress.next ? ` · prossimo: ${progress.next}` : ''}` : 'Assistente operativo della segnalazione'}</small></div>
        <button type="button" className="rs-randai-workspace__toggle" onClick={() => setOpen((value) => !value)} aria-expanded={open} data-testid="randai-workspace-toggle">{open ? 'Chiudi' : progress ? 'Continua con RandAI' : 'Apri RandAI'}</button>
      </div>
      {progress && <div className="rs-randai-progress" aria-label={`Progresso ${progress.percent}%`}><span style={{ width: `${progress.percent}%` }} /></div>}

      {open && <div className="rs-randai-workspace__body" data-testid="randai-workspace-body">
        <div className="rs-randai-tabs" role="tablist" aria-label="Strumenti RandAI">{TABS.map(([key, label]) => <button type="button" key={key} role="tab" aria-selected={tab === key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>)}</div>

        {tab === 'analyze' && <div className="rs-randai-pane">
          {guidanceState.loading ? <p className="rs-randai-suggestion__muted">Analizzo contesto, impianto e dati disponibili…</p> : suggestion ? <>
            <p>{suggestion.text}</p>{suggestion.detail && <small className="rs-randai-suggestion__detail">{suggestion.detail}</small>}{suggestion.caution && <small className="rs-randai-suggestion__caution">{suggestion.caution}</small>}<small className="rs-randai-suggestion__source">Fonte: {suggestion.source}</small>
          </> : <p className="rs-randai-suggestion__muted">{guidanceState.unavailable ? 'RandAI non è disponibile in questo momento.' : 'Non ci sono elementi sufficienti per una diagnosi affidabile. RandAI non improvvisa.'}</p>}
        </div>}

        {tab === 'guide' && <div className="rs-randai-pane">
          {workspaceState.loading ? <p className="rs-randai-suggestion__muted">Carico il percorso salvato…</p> : workspaceState.task ? <>
            <div className="rs-randai-task-state"><strong>{progress?.label}</strong><small>Stato: {workspaceState.task.status}</small></div>
            {progress?.next ? <>
              <p className="rs-randai-next"><span>Prossimo controllo</span><strong>{progress.next}</strong></p>
              <textarea className="rs-randai-step-note" rows="2" value={stepNote} onChange={(event) => setStepNote(event.target.value)} placeholder="Nota facoltativa sul controllo eseguito" />
              <button type="button" className="rs-randai-actions__primary" disabled={workspaceState.busy} onClick={confirmStep}>{workspaceState.busy ? 'Salvo…' : 'Conferma passaggio'}</button>
              <small className="rs-randai-suggestion__source">La conferma indica un controllo fisico eseguito dal manutentore; RandAI non lo dichiara verificato da sola.</small>
            </> : <>
              <p>{workspaceState.task.status === 'VERIFYING' ? 'Tutti i controlli guidati risultano confermati. Verifica che il problema sia realmente risolto prima di chiudere.' : 'Il percorso non ha altri passaggi aperti.'}</p>
              {canComplete && issue.status !== 'done' && !summaryPreview && <button type="button" className="rs-randai-actions__primary" disabled={workspaceState.busy} onClick={buildSummary}>Prepara riepilogo intervento</button>}
              {summaryPreview && <div className="rs-randai-summary-preview" data-testid="randai-completion-summary"><strong>Riepilogo proposto</strong><div>{summaryPreview}</div><button type="button" className="rs-randai-actions__primary" disabled={actionState.busy} onClick={() => prepare('issue.mark_done', { completionNote: summaryPreview })}>Concludi con questo riepilogo</button><small>La segnalazione non viene chiusa finché non confermi l’azione nel Gateway.</small></div>}
            </>}
          </> : guidance?.procedure ? <><p>È disponibile una procedura interna verificata. RandAI può trasformarla in un percorso persistente con checkpoint, così puoi uscire e riprendere da qui.</p><button type="button" className="rs-randai-actions__primary" disabled={workspaceState.busy} onClick={startGuide}>{workspaceState.busy ? 'Avvio…' : 'Avvia percorso guidato'}</button></> : <p className="rs-randai-suggestion__muted">Non esiste ancora una procedura verificata adatta. Usa Analizza e Casi simili; RandAI non genera una procedura operativa non approvata.</p>}
        </div>}

        {tab === 'procedure' && <div className="rs-randai-pane">{guidance?.procedure ? <><strong>{guidance.procedure.title}</strong>{guidance.procedure.summary && <p>{guidance.procedure.summary}</p>}<ol className="rs-randai-procedure">{(guidance.procedure.steps || []).map((step, index) => <li key={`${index}-${step}`}>{step}</li>)}</ol>{guidance.procedure.caution && <small className="rs-randai-suggestion__caution">{guidance.procedure.caution}</small>}<small className="rs-randai-suggestion__source">Fonte: {guidance.procedure.sourceLabel || 'Procedura interna approvata'}</small></> : <p className="rs-randai-suggestion__muted">Nessuna procedura interna approvata collegata a questa segnalazione.</p>}</div>}

        {tab === 'similar' && <div className="rs-randai-pane">
          {memory.length > 0 && <div className="rs-randai-similar"><strong>Memoria verificata</strong>{memory.slice(0, 3).map((item) => <article key={item.id}><b>{item.solution}</b>{item.cause && <small>Causa: {item.cause}</small>}<small>{item.sourceLabel || 'Memoria RandAI verificata'}</small></article>)}</div>}
          {history.length > 0 && <div className="rs-randai-similar"><strong>Interventi precedenti</strong>{history.map((item) => <article key={`${item.kind}-${item.id}`}><b>{item.location || item.category || 'Caso precedente'}</b><span>{item.text || 'Nessuna nota finale disponibile'}</span><small>{item.kind}{item.date ? ` · ${new Date(item.date).toLocaleDateString('it-IT')}` : ''}</small></article>)}</div>}
          {memory.length === 0 && history.length === 0 && <p className="rs-randai-suggestion__muted">Nessun caso sufficientemente simile trovato nello storico della struttura.</p>}
        </div>}

        {workspaceState.error && <small className="rs-randai-action-error" role="alert">{workspaceState.error}</small>}
        {workspaceState.success && <small className="rs-randai-action-success" role="status">{workspaceState.success}</small>}

        {hasActions && !actionState.plan && <details className="rs-randai-actions" data-testid="randai-action-gateway"><summary>Azioni sicure su RandApp</summary><small>Ogni modifica passa dal Gateway: permessi, struttura, rischio, conferma, esecuzione e verifica server-side.</small>{canEdit && <div className="rs-randai-actions__row" aria-label="Cambia urgenza">{['alta', 'media', 'bassa'].filter((priority) => priority !== issue.urgency).map((priority) => <button type="button" key={priority} disabled={actionState.busy} onClick={() => prepare('issue.update_priority', { priority })}>Urgenza {priority}</button>)}</div>}{canComplete && <button type="button" className="rs-randai-actions__primary" disabled={actionState.busy} onClick={() => prepare('issue.mark_done')}>Prepara completamento</button>}</details>}

        {actionState.plan && <div className="rs-randai-approval" data-testid="randai-action-approval"><span>Conferma richiesta · rischio {actionState.plan.risk}</span><strong>{actionState.plan.summary}</strong><small>Nessuna modifica è stata ancora eseguita. La conferma vale solo per questa versione della segnalazione.</small><div className="rs-randai-actions__row"><button type="button" disabled={actionState.busy} onClick={cancelPlan}>Annulla</button><button type="button" className="rs-randai-actions__primary" disabled={actionState.busy} onClick={confirmPlan}>{actionState.busy ? 'Verifico…' : 'Conferma ed esegui'}</button></div></div>}
        {actionState.error && <small className="rs-randai-action-error" role="alert">{actionState.error}</small>}
        {actionState.success && <small className="rs-randai-action-success" role="status">{actionState.success}</small>}
      </div>}
    </section>
  )
}
