import { GuidanceStatus, StepResult, validateGuidedProcedure } from './contracts.js'
import { GuidanceStore } from './store.js'

const clone = (value) => structuredClone(value)
const makeId = () => `GUIDE-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`}`

const ROLE_RANK = Object.freeze({
  staff: 1,
  manutentore: 2,
  responsabile: 3,
  tecnico_esterno: 4,
})

function canExecute(actorRole, requiredRole) {
  if (!requiredRole) return true
  return (ROLE_RANK[actorRole] || 0) >= (ROLE_RANK[requiredRole] || Infinity)
}

export class GuidedProcedureEngine {
  constructor({ store = new GuidanceStore() } = {}) { this.store = store }

  async start({ procedure, actorRole = 'staff', source = null, report = null } = {}) {
    validateGuidedProcedure(procedure)
    const first = procedure.steps[0]
    const now = new Date().toISOString()
    const session = {
      id: makeId(),
      hotelId: procedure.hotelId,
      procedureId: procedure.id,
      procedureVersion: procedure.version || 1,
      title: procedure.title,
      actorRole,
      source,
      report,
      status: GuidanceStatus.ACTIVE,
      currentStepId: first.id,
      history: [],
      decisions: [],
      blockedReason: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      procedure: clone(procedure),
    }
    await this.#enforceAuthorization(session)
    await this.store.save(session)
    return clone(session)
  }

  async current(id) {
    const session = await this.#require(id)
    const step = session.procedure.steps.find((item) => item.id === session.currentStepId) || null
    return { session: clone(session), step: clone(step) }
  }

  async answer(id, result, { note = null } = {}) {
    if (!Object.values(StepResult).includes(result)) throw new TypeError(`Invalid step result: ${result}`)
    const session = await this.#require(id)
    if (session.status !== GuidanceStatus.ACTIVE) throw new Error(`Guidance session is not active: ${session.status}`)
    const step = session.procedure.steps.find((item) => item.id === session.currentStepId)
    if (!step) throw new Error(`Unknown current step: ${session.currentStepId}`)
    if (!canExecute(session.actorRole, step.requiredRole)) {
      session.status = GuidanceStatus.BLOCKED
      session.blockedReason = `ROLE_REQUIRED:${step.requiredRole}`
      session.updatedAt = new Date().toISOString()
      await this.store.save(session)
      return clone(session)
    }

    const now = new Date().toISOString()
    session.history.push({ stepId: step.id, result, note, at: now })

    if (result === StepResult.ESCALATE || step.stopOn?.includes?.(result)) {
      session.status = GuidanceStatus.BLOCKED
      session.blockedReason = result === StepResult.ESCALATE ? 'ESCALATION_REQUIRED' : `STOP_ON:${result}`
      session.currentStepId = step.id
      session.updatedAt = now
      await this.store.save(session)
      return clone(session)
    }

    const nextId = step.next?.[result] ?? step.next?.default ?? null
    if (!nextId) {
      session.status = GuidanceStatus.COMPLETED
      session.currentStepId = null
      session.completedAt = now
      session.updatedAt = now
      await this.store.save(session)
      return clone(session)
    }

    session.decisions.push({ from: step.id, result, to: nextId, at: now })
    session.currentStepId = nextId
    session.updatedAt = now
    await this.#enforceAuthorization(session)
    await this.store.save(session)
    return clone(session)
  }

  async resume(id, { actorRole } = {}) {
    const session = await this.#require(id)
    if (actorRole) session.actorRole = actorRole
    if (session.status === GuidanceStatus.BLOCKED || session.status === GuidanceStatus.PAUSED) {
      session.status = GuidanceStatus.ACTIVE
      session.blockedReason = null
      session.updatedAt = new Date().toISOString()
      await this.#enforceAuthorization(session)
      await this.store.save(session)
    }
    return clone(session)
  }

  async pause(id) {
    const session = await this.#require(id)
    if (session.status === GuidanceStatus.ACTIVE) {
      session.status = GuidanceStatus.PAUSED
      session.updatedAt = new Date().toISOString()
      await this.store.save(session)
    }
    return clone(session)
  }

  async #enforceAuthorization(session) {
    const step = session.procedure.steps.find((item) => item.id === session.currentStepId)
    if (step && !canExecute(session.actorRole, step.requiredRole)) {
      session.status = GuidanceStatus.BLOCKED
      session.blockedReason = `ROLE_REQUIRED:${step.requiredRole}`
    }
  }

  async #require(id) {
    const session = await this.store.get(id)
    if (!session) throw new Error(`Unknown guidance session: ${id}`)
    return session
  }
}
