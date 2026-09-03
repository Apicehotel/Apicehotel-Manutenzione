import { ToolPermission, ToolRisk } from '../tools/contracts.js'
import { AutonomyDecision, AutonomyLevel, ApprovalStatus, RISK_ORDER, actionIdentity, actionScope, requiresHumanByTool, validateAutonomyPolicy } from './contracts.js'
import { ApprovalStore, AutonomyPolicyStore } from './store.js'
import { resolveAutonomyDecision } from './decision.js'

const clone = (value) => structuredClone(value)
const nowIso = () => new Date().toISOString()
const makeId = () => `APR-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`}`

export class PermissionAutonomyEngine {
  constructor({ toolRegistry, policyStore = new AutonomyPolicyStore(), approvalStore = new ApprovalStore(), policyId = 'default', approvalTtlMs = 24 * 60 * 60 * 1000 } = {}) {
    if (!toolRegistry) throw new TypeError('toolRegistry is required')
    if (!Number.isFinite(Number(approvalTtlMs)) || Number(approvalTtlMs) <= 0) throw new TypeError('approvalTtlMs must be a finite number > 0')
    this.toolRegistry = toolRegistry
    this.policyStore = policyStore
    this.approvalStore = approvalStore
    this.policyId = policyId
    this.approvalTtlMs = Number(approvalTtlMs)
  }

  async setPolicy(policy) { validateAutonomyPolicy(policy); return this.policyStore.save(policy) }

  async getPolicy() {
    return (await this.policyStore.get(this.policyId)) || { id: this.policyId, level: AutonomyLevel.SUGGEST, maxRisk: ToolRisk.MEDIUM, allowedTools: [], deniedTools: [] }
  }

  async evaluate({ toolId, input = {}, taskId = null, stepId = null, hotelId = null, scope = null, policy = null } = {}) {
    const tool = this.toolRegistry.get(toolId)
    if (!tool) return { decision: AutonomyDecision.DENY, reason: 'UNKNOWN_TOOL', toolId }
    const active = policy || await this.getPolicy()
    validateAutonomyPolicy(active)
    const identity = actionIdentity({ toolId, taskId, stepId, input, hotelId, scope })
    const scopeKey = actionScope({ hotelId, scope })
    const existing = await this.approvalStore.findByIdentity(identity)
    if (existing?.status === ApprovalStatus.APPROVED && !this.#expired(existing)) return { decision: AutonomyDecision.ALLOW, reason: 'EXPLICIT_APPROVAL', approval: existing, tool: this.#tool(tool), identity, scopeKey }
    if (existing?.status === ApprovalStatus.REJECTED && !this.#expired(existing)) return { decision: AutonomyDecision.DENY, reason: 'EXPLICIT_REJECTION', approval: existing, tool: this.#tool(tool), identity, scopeKey }

    if ((active.deniedTools || []).includes(toolId)) return { decision: AutonomyDecision.DENY, reason: 'TOOL_DENIED_BY_POLICY', tool: this.#tool(tool), identity, scopeKey }
    if ((active.allowedTools || []).length && !active.allowedTools.includes(toolId)) return { decision: AutonomyDecision.DENY, reason: 'TOOL_NOT_ALLOWLISTED', tool: this.#tool(tool), identity, scopeKey }
    const maxRisk = active.maxRisk || ToolRisk.CRITICAL
    if (RISK_ORDER.indexOf(tool.risk) > RISK_ORDER.indexOf(maxRisk)) return { decision: AutonomyDecision.REQUIRE_APPROVAL, reason: 'RISK_EXCEEDS_POLICY', tool: this.#tool(tool), identity, scopeKey }

    if (active.level === AutonomyLevel.OBSERVE) return { decision: AutonomyDecision.OBSERVE_ONLY, reason: 'AUTONOMY_L0', tool: this.#tool(tool), identity, scopeKey }
    if (active.level === AutonomyLevel.SUGGEST) {
      if (tool.permission === ToolPermission.READ && tool.risk === ToolRisk.LOW) return { decision: AutonomyDecision.ALLOW, reason: 'L1_LOW_RISK_READ', tool: this.#tool(tool), identity, scopeKey }
      return { decision: AutonomyDecision.OBSERVE_ONLY, reason: 'AUTONOMY_L1', tool: this.#tool(tool), identity, scopeKey }
    }
    if (active.level === AutonomyLevel.PREPARE) {
      if (tool.permission === ToolPermission.READ) return { decision: AutonomyDecision.ALLOW, reason: 'L2_READ_ALLOWED', tool: this.#tool(tool), identity, scopeKey }
      return { decision: AutonomyDecision.PREPARE_ONLY, reason: 'AUTONOMY_L2', tool: this.#tool(tool), identity, scopeKey }
    }

    if (requiresHumanByTool(tool)) return { decision: AutonomyDecision.REQUIRE_APPROVAL, reason: 'CRITICAL_OR_ADMIN_REQUIRES_HUMAN', tool: this.#tool(tool), identity, scopeKey }
    if (active.level === AutonomyLevel.EXECUTE_SAFE) {
      if (tool.risk === ToolRisk.HIGH || tool.permission === ToolPermission.WRITE_PROTECTED) return { decision: AutonomyDecision.REQUIRE_APPROVAL, reason: 'L3_PROTECTED_ACTION', tool: this.#tool(tool), identity, scopeKey }
      return { decision: AutonomyDecision.ALLOW, reason: 'L3_SAFE_ACTION', tool: this.#tool(tool), identity, scopeKey }
    }
    return { decision: AutonomyDecision.ALLOW, reason: 'L4_AUTONOMOUS_ACTION', tool: this.#tool(tool), identity, scopeKey }
  }

  async evaluateOperationalAction({ confidenceDecision, planValidation = { ok: true }, permissionGranted = false, humanConfirmed = false, contextValid = true, requestedLevel = null, ...action } = {}) {
    const evaluation = await this.evaluate(action)
    return resolveAutonomyDecision({
      evaluation,
      confidenceDecision,
      planValidation,
      permissionGranted,
      humanConfirmed,
      contextValid,
      requestedLevel,
      policyLevel: (action.policy || await this.getPolicy()).level,
    })
  }

  async requestApproval({ toolId, input = {}, taskId = null, stepId = null, hotelId = null, scope = null, reason = null, payload = {} } = {}) {
    const identity = actionIdentity({ toolId, taskId, stepId, input, hotelId, scope })
    const scopeKey = actionScope({ hotelId, scope })
    const current = await this.approvalStore.findByIdentity(identity)
    if (current && [ApprovalStatus.PENDING, ApprovalStatus.APPROVED, ApprovalStatus.REJECTED].includes(current.status) && !this.#expired(current)) return current
    const requestedAt = nowIso()
    return this.approvalStore.save({
      id: makeId(), identity, toolId, taskId, stepId, hotelId: hotelId || null, scope: scope || null, scopeKey,
      status: ApprovalStatus.PENDING, requestedAt, decidedAt: null,
      expiresAt: new Date(Date.now() + this.approvalTtlMs).toISOString(), decidedBy: null, reason,
      payload: clone({ ...payload, scopeContext: { hotelId: hotelId || null, scope: scope || null, scopeKey } }),
    })
  }

  async decide(approvalId, { approved, decidedBy, reason = null, hotelId = undefined, scope = undefined } = {}) {
    if (typeof approved !== 'boolean') throw new TypeError('approved boolean is required')
    if (!decidedBy) throw new TypeError('decidedBy is required')
    const item = await this.approvalStore.get(approvalId)
    if (!item) throw new Error(`Unknown approval: ${approvalId}`)
    if (hotelId !== undefined || scope !== undefined) {
      const expected = actionScope({ hotelId: hotelId || null, scope: scope || null })
      const actual = item.scopeKey || item.payload?.scopeContext?.scopeKey || actionScope({ hotelId: item.hotelId || null, scope: item.scope || null })
      if (expected !== actual) throw new Error(`Approval scope mismatch: expected ${expected}, actual ${actual}`)
    }
    if (this.#expired(item)) return this.approvalStore.save({ ...item, status: ApprovalStatus.EXPIRED, decidedAt: nowIso(), reason: reason || 'approval_expired' })
    if (item.status !== ApprovalStatus.PENDING) throw new Error(`Approval already decided: ${item.status}`)
    return this.approvalStore.save({ ...item, status: approved ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED, decidedAt: nowIso(), decidedBy, reason })
  }

  async authorize(action) {
    const evaluation = await this.evaluate(action)
    if (evaluation.decision !== AutonomyDecision.REQUIRE_APPROVAL) return evaluation
    const approval = await this.requestApproval({ ...action, reason: evaluation.reason, payload: { tool: evaluation.tool } })
    return { ...evaluation, approval }
  }

  #expired(item) { return Boolean(item?.expiresAt && new Date(item.expiresAt).getTime() <= Date.now()) }
  #tool(tool) { return { id: tool.id, permission: tool.permission, risk: tool.risk, name: tool.name } }
}
