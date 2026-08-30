import { ToolStatus } from '../tools/contracts.js'

export class RandAIVerifier {
  constructor({ verifiers = {} } = {}) { this.verifiers = { ...verifiers } }
  register(id, verifier) {
    if (!id || typeof verifier !== 'function') throw new TypeError('verifier id and function are required')
    this.verifiers[id] = verifier
    return this
  }
  async verify({ task, step, result, strategy }) {
    const verifierId = step.verification?.verifierId
    if (verifierId) {
      const verifier = this.verifiers[verifierId]
      if (!verifier) return { ok: false, reason: `Missing verifier ${verifierId}` }
      const value = await verifier({ task, step, result, strategy, criteria: step.verification?.criteria || [] })
      return typeof value === 'boolean' ? { ok: value } : { ok: Boolean(value?.ok), ...value }
    }
    const ok = result?.status === ToolStatus.SUCCESS
    return { ok, reason: ok ? 'tool_success' : `tool_status_${result?.status || 'UNKNOWN'}` }
  }
}
