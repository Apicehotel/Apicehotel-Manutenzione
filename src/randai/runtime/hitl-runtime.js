import { executionPolicyForTool, ExecutionDisposition } from './risk-policy.js'
import { sandboxPolicyForTool, assertSandboxDescriptor } from './sandbox.js'

export class RandHITLRuntime {
  constructor({ prepareApproval, executeApproved, rejectApproval, audit = async () => {} } = {}) {
    this.prepareApproval = prepareApproval
    this.executeApproved = executeApproved
    this.rejectApproval = rejectApproval
    this.audit = audit
  }

  async decide({ tool, input = {}, context = {} } = {}) {
    if (!tool?.id) throw new TypeError('Tool id is required')
    const policy = executionPolicyForTool(tool)
    const sandbox = sandboxPolicyForTool(tool)
    assertSandboxDescriptor(sandbox)
    const decision = Object.freeze({ toolId: tool.id, policy, sandbox, input, context })
    await this.audit({ type: 'HITL_DECISION', decision })
    return decision
  }

  async prepare({ tool, input = {}, context = {} } = {}) {
    const decision = await this.decide({ tool, input, context })
    if (decision.policy.disposition === ExecutionDisposition.BLOCK) return Object.freeze({ status: 'BLOCKED', ...decision })
    if (decision.policy.disposition === ExecutionDisposition.AUTO) return Object.freeze({ status: 'AUTO', ...decision })
    if (decision.policy.disposition === ExecutionDisposition.PREVIEW) return Object.freeze({ status: 'PREVIEW_REQUIRED', ...decision })
    if (typeof this.prepareApproval !== 'function') throw new Error('APPROVAL_GATEWAY_REQUIRED')
    const approval = await this.prepareApproval({ tool, input, context })
    return Object.freeze({ status: 'APPROVAL_REQUIRED', approval, ...decision })
  }

  async execute({ prepared, approved = false } = {}) {
    if (!prepared?.status) throw new TypeError('Prepared HITL decision required')
    if (prepared.status === 'BLOCKED') throw new Error('ACTION_BLOCKED')
    if (prepared.status === 'PREVIEW_REQUIRED' && !approved) throw new Error('PREVIEW_CONFIRMATION_REQUIRED')
    if (prepared.status === 'APPROVAL_REQUIRED') {
      if (!approved) throw new Error('HUMAN_APPROVAL_REQUIRED')
      if (typeof this.executeApproved !== 'function') throw new Error('APPROVAL_EXECUTOR_REQUIRED')
      return this.executeApproved(prepared.approval)
    }
    return Object.freeze({ status: 'READY_FOR_TOOL_EXECUTION', toolId: prepared.toolId, input: prepared.input, sandbox: prepared.sandbox })
  }

  async reject(prepared) {
    if (prepared?.approval && typeof this.rejectApproval === 'function') return this.rejectApproval(prepared.approval)
    return null
  }
}
