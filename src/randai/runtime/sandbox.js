export const SandboxMode = Object.freeze({
  NONE: 'NONE',
  PURE: 'PURE',
  ISOLATED_TOOL: 'ISOLATED_TOOL',
})

export function sandboxPolicyForTool(tool = {}) {
  if (tool.permission === 'READ' && tool.risk === 'LOW') return Object.freeze({ mode: SandboxMode.PURE, network: false, filesystem: false, hostExecution: false })
  return Object.freeze({ mode: SandboxMode.ISOLATED_TOOL, network: false, filesystem: false, hostExecution: false })
}

export function assertSandboxDescriptor(descriptor = {}) {
  if (!Object.values(SandboxMode).includes(descriptor.mode)) throw new TypeError('Invalid sandbox mode')
  if (descriptor.hostExecution === true) throw new Error('UNRESTRICTED_HOST_EXECUTION_DENIED')
  return true
}
