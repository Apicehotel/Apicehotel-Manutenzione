import { ToolStatus } from '../tools/contracts.js'
import { evaluateVerificationGate, VerificationDecision } from '../../reliability/verification-gate.js'

export class RandAIVerifier {
  constructor({ verifiers = {}, verificationGate = evaluateVerificationGate } = {}) {
    if (typeof verificationGate !== 'function') throw new TypeError('verificationGate must be a function')
    this.verifiers = { ...verifiers }
    this.verificationGate = verificationGate
  }
  register(id, verifier) {
    if (!id || typeof verifier !== 'function') throw new TypeError('verifier id and function are required')
    this.verifiers[id] = verifier
    return this
  }
  async verify({ task, step, result, strategy }) {
    const verifierId = step.verification?.verifierId
    let domainVerification
    if (verifierId) {
      const verifier = this.verifiers[verifierId]
      if (!verifier) return { ok: false, reason: `Missing verifier ${verifierId}` }
      const value = await verifier({ task, step, result, strategy, criteria: step.verification?.criteria || [] })
      domainVerification = typeof value === 'boolean' ? { ok: value } : { ok: Boolean(value?.ok), ...value }
    } else {
      const ok = result?.status === ToolStatus.SUCCESS
      domainVerification = { ok, reason: ok ? 'tool_success' : `tool_status_${result?.status || 'UNKNOWN'}` }
    }

    const gateConfig = step.verification?.gate
    if (!domainVerification.ok || !gateConfig) return domainVerification

    const hotelId = task?.metadata?.hotelId
    const gate = this.verificationGate({
      hotelId,
      expectedHotelId: gateConfig.expectedHotelId ?? step.targetHotelId ?? strategy?.targetHotelId ?? hotelId,
      checks: gateConfig.checks ?? domainVerification.checks ?? result?.metadata?.verificationChecks ?? [],
      minScore: gateConfig.minScore,
      requireIndependent: gateConfig.requireIndependent,
      allowReview: gateConfig.allowReview,
    })

    return {
      ...domainVerification,
      ok: gate.decision === VerificationDecision.PASS,
      reason: gate.decision === VerificationDecision.PASS ? domainVerification.reason : `verification_gate_${gate.decision.toLowerCase()}`,
      gate,
    }
  }
}
