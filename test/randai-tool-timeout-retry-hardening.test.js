import test from 'node:test'
import assert from 'node:assert/strict'
import { ToolRegistry } from '../src/randai/tools/registry.js'
import { ToolPermission, ToolStatus } from '../src/randai/tools/contracts.js'
import { RandAIError, RandAIErrorCode } from '../src/randai/core/errors.js'

test('read tool timeout is bounded, abortable and retryable', async () => {
  const registry = new ToolRegistry()
  let attempts = 0
  registry.register({
    id: 'read.timeout', name: 'Read timeout', permission: ToolPermission.READ,
    timeoutMs: 10, retryPolicy: { maxAttempts: 2 },
    execute: async (_input, { signal }) => {
      attempts += 1
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, 100)
        signal.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason) }, { once: true })
      })
      return { ok: true }
    },
  })
  const result = await registry.execute('read.timeout', {})
  assert.equal(result.status, ToolStatus.RETRYABLE)
  assert.equal(result.error.code, RandAIErrorCode.TIMEOUT)
  assert.equal(attempts, 2)
})

test('non-idempotent write timeout never auto-retries and marks unknown outcome', async () => {
  const registry = new ToolRegistry()
  let attempts = 0
  registry.register({
    id: 'write.timeout', name: 'Write timeout', permission: ToolPermission.WRITE,
    timeoutMs: 10, retryPolicy: { maxAttempts: 5 },
    execute: async (_input, { signal }) => {
      attempts += 1
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, 100)
        signal.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason) }, { once: true })
      })
    },
  })
  const result = await registry.execute('write.timeout', {})
  assert.equal(result.status, ToolStatus.FAILED)
  assert.equal(result.error.code, RandAIErrorCode.TIMEOUT)
  assert.equal(result.metadata.outcomeUnknown, true)
  assert.equal(attempts, 1)
})

test('retryable read error follows bounded retry policy and succeeds', async () => {
  const registry = new ToolRegistry()
  let attempts = 0
  registry.register({
    id: 'read.flaky', name: 'Flaky read', permission: ToolPermission.READ,
    retryPolicy: { maxAttempts: 3 },
    execute: async () => {
      attempts += 1
      if (attempts < 3) throw new RandAIError(RandAIErrorCode.NETWORK_ERROR, 'temporary', { retryable: true })
      return { ok: true }
    },
  })
  const result = await registry.execute('read.flaky', {})
  assert.equal(result.status, ToolStatus.SUCCESS)
  assert.equal(attempts, 3)
})

test('retryable write error does not retry unless tool is explicitly idempotent', async () => {
  const registry = new ToolRegistry()
  let attempts = 0
  registry.register({
    id: 'write.flaky', name: 'Flaky write', permission: ToolPermission.WRITE,
    retryPolicy: { maxAttempts: 3 },
    execute: async () => {
      attempts += 1
      throw new RandAIError(RandAIErrorCode.NETWORK_ERROR, 'unknown write outcome', { retryable: true })
    },
  })
  const result = await registry.execute('write.flaky', {})
  assert.equal(result.status, ToolStatus.FAILED)
  assert.equal(attempts, 1)
})
