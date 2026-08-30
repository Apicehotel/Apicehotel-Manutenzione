import { GuidanceSessionStatus, GuidanceStepStatus, ROLE_RANK, StepAction, assertGuidedProcedure } from './contracts.js'

const clone = (value) => structuredClone(value)
const makeId = () => `GUIDE-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`}`

export class GuidedProcedureRunner {
  constructor({ store = null } = {}) { this.store = store }

  async start({ procedure, actorRole = 'staff', metadata = {} } = {}) {
    assertGuidedProcedure(procedure)
    const first = procedure.steps[0]
    const now = new Date().toISOString()
    const session = {
      id: makeId(), hotelId: procedure.hotelId, procedureId: procedure.id, procedureVersion: procedure.version || 1,
      title: procedure.title, actorRole, status: GuidanceSessionStatus.ACTIVE, currentStepId: first.id,
      steps: procedure.steps.map((step, index) => ({ ...clone(step), order: index, status: index === 0 ? GuidanceStepStatus.ACTIVE : GuidanceStepStatus.PENDING, result: null, completedAt: null })),
      events: [{ type: 'STARTED', stepId: first.id, at: now }], metadata: clone(metadata), createdAt: now, updatedAt: now, completedAt: null,
    }
    this.#enforcePermission(session)
    await this.#save(session)
    return clone(session)
  }

  async respond(session, { action, note = null, evidence = null } = {}) {
    if (!Object.values(StepAction).includes(action)) throw new TypeError(`Unsupported guidance action: ${action}`)
    if (session.status !== GuidanceSessionStatus.ACTIVE) throw new Error(`Guidance session is not active: ${session.status}`)
    const current = session.steps.find((step) => step.id === session.currentStepId)
    if (!current) throw new Error('Current guidance step is missing')
    this.#enforcePermission(session)
    if (session.status !== GuidanceSessionStatus.ACTIVE) { await this.#save(session); return clone(session) }

    const now = new Date().toISOString()
    current.status = GuidanceStepStatus.COMPLETED
    current.result = { action, note, evidence }
    current.completedAt = now
    session.events.push({ type: 'STEP_COMPLETED', stepId: current.id, action, at: now })

    const target = current.transitions?.[action] || current.next || 'COMPLETE'
    if (action === StepAction.ESCALATE || target === 'ESCALATE') {
      session.status = GuidanceSessionStatus.ESCALATED
      session.currentStepId = null
      session.events.push({ type: 'ESCALATED', stepId: current.id, at: now })
    } else if (target === 'COMPLETE') {
      session.status = GuidanceSessionStatus.COMPLETED
      session.currentStepId = null
      session.completedAt = now
      session.events.push({ type: 'COMPLETED', at: now })
    } else {
      const next = session.steps.find((step) => step.id === target)
      if (!next) throw new Error(`Unknown next guidance step: ${target}`)
      next.status = GuidanceStepStatus.ACTIVE
      session.currentStepId = next.id
      session.updatedAt = now
      this.#enforcePermission(session)
    }
    session.updatedAt = now
    await this.#save(session)
    return clone(session)
  }

  #enforcePermission(session) {
    const current = session.steps.find((step) => step.id === session.currentStepId)
    if (!current) return
    const required = current.requiredRole || 'staff'
    if ((ROLE_RANK[session.actorRole] || 0) >= (ROLE_RANK[required] || 99)) return
    current.status = GuidanceStepStatus.BLOCKED
    session.status = GuidanceSessionStatus.BLOCKED
    session.events.push({ type: 'PERMISSION_BLOCKED', stepId: current.id, requiredRole: required, actorRole: session.actorRole, at: new Date().toISOString() })
  }

  async #save(session) { if (this.store?.save) await this.store.save(session) }
}
