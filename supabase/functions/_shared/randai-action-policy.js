const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max)

export const ACTION_DEFINITIONS = Object.freeze({
  'issue.update_priority': Object.freeze({
    resourceType: 'issue',
    module: 'issues',
    permission: 'edit',
    risk: 'MEDIUM',
    approvalRequired: true,
  }),
  'issue.set_waiting_part': Object.freeze({
    resourceType: 'issue',
    module: 'issues',
    permission: 'take_charge',
    risk: 'MEDIUM',
    approvalRequired: true,
  }),
  'issue.mark_done': Object.freeze({
    resourceType: 'issue',
    module: 'issues',
    permission: 'complete',
    risk: 'HIGH',
    approvalRequired: true,
  }),
})

export function getActionDefinition(type) {
  return ACTION_DEFINITIONS[clean(type, 120)] || null
}

export function sanitizeActionRequest(input) {
  if (!input || typeof input !== 'object') return null
  const type = clean(input.type, 120)
  const resourceId = clean(input.resource_id || input.resourceId, 120)
  const definition = getActionDefinition(type)
  if (!definition || !resourceId) return null
  const raw = input.input && typeof input.input === 'object' ? input.input : {}
  let actionInput = {}
  if (type === 'issue.update_priority') {
    const priority = clean(raw.priority, 20).toLowerCase()
    if (!['alta', 'media', 'bassa'].includes(priority)) return null
    actionInput = { priority }
  } else if (type === 'issue.set_waiting_part') {
    const partName = clean(raw.part_name || raw.partName, 180)
    if (!partName) return null
    actionInput = { partName }
  } else if (type === 'issue.mark_done') {
    actionInput = { completionNote: clean(raw.completion_note || raw.completionNote, 800) || null }
  }
  return { type, resourceId, input: actionInput, definition }
}

export function buildIssuePatch(action, actorName, nowIso) {
  if (!action) throw new TypeError('action is required')
  if (action.type === 'issue.update_priority') return { urgenza: action.input.priority }
  if (action.type === 'issue.set_waiting_part') return {
    stato: 'waiting',
    pezzo_nome: action.input.partName,
    attesa_da: actorName || 'RandAI Action Gateway',
    attesa_dal: nowIso,
  }
  if (action.type === 'issue.mark_done') {
    const patch = {
      stato: 'done',
      completato_da: actorName || 'RandAI Action Gateway',
      completato_il: nowIso,
    }
    if (action.input.completionNote) patch.nota_completamento = action.input.completionNote
    return patch
  }
  throw new Error('unsupported_action')
}

export function buildIssuePreview(row, action, actorName, nowIso) {
  const before = {
    id: row.id,
    hotel_id: row.hotel_id,
    camera: row.camera,
    urgenza: row.urgenza,
    categoria: row.categoria,
    stato: row.stato,
    pezzo_nome: row.pezzo_nome || null,
    nota_completamento: row.nota_completamento || null,
    updated_at: row.updated_at,
  }
  const patch = buildIssuePatch(action, actorName, nowIso)
  return { before, patch, after: { ...before, ...patch } }
}

export function validateIssueTransition(row, action) {
  if (!row || !action) return { ok: false, reason: 'INVALID_RESOURCE' }
  if (action.type === 'issue.mark_done' && row.stato === 'done') return { ok: false, reason: 'ALREADY_DONE' }
  if (action.type === 'issue.set_waiting_part' && row.stato === 'done') return { ok: false, reason: 'TERMINAL_RESOURCE' }
  return { ok: true }
}

export function verifyAppliedIssueAction(row, action) {
  if (!row) return false
  if (action.type === 'issue.update_priority') return row.urgenza === action.input.priority
  if (action.type === 'issue.set_waiting_part') return row.stato === 'waiting' && row.pezzo_nome === action.input.partName
  if (action.type === 'issue.mark_done') return row.stato === 'done' && Boolean(row.completato_il)
  return false
}

export function summarizeAction(action) {
  if (action.type === 'issue.update_priority') return `Cambia urgenza in ${action.input.priority}`
  if (action.type === 'issue.set_waiting_part') return `Metti in attesa pezzo: ${action.input.partName}`
  if (action.type === 'issue.mark_done') return 'Segna la segnalazione come completata'
  return action.type
}
