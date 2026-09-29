import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CapabilityProviderStatus,
  CapabilityRoutingError,
  RandCapabilityRouter,
} from '../src/randai/core/capability-router.js'

test('capability router selects the first available provider by priority', async () => {
  const calls = []
  const router = new RandCapabilityRouter()
  router.register({
    id: 'secondary',
    capabilities: ['notify.send'],
    priority: 20,
    execute: async () => { calls.push('secondary'); return 'secondary' },
  })
  router.register({
    id: 'primary',
    capabilities: ['notify.send'],
    priority: 10,
    execute: async () => { calls.push('primary'); return 'primary' },
  })

  const result = await router.invoke('notify.send')
  assert.equal(result.value, 'primary')
  assert.equal(result.trace.providerId, 'primary')
  assert.deepEqual(calls, ['primary'])
})

test('capability router skips providers unavailable at preflight', async () => {
  const router = new RandCapabilityRouter()
  router.register({
    id: 'primary',
    capabilities: ['notify.send'],
    priority: 10,
    isAvailable: () => false,
    execute: async () => 'should-not-run',
  })
  router.register({
    id: 'fallback',
    capabilities: ['notify.send'],
    priority: 20,
    execute: async () => 'fallback',
  })

  const result = await router.invoke('notify.send')
  assert.equal(result.value, 'fallback')
  assert.equal(result.trace.providerId, 'fallback')
  assert.equal(result.trace.fallbackCount, 0)
})

test('capability router fails closed when no provider is available', async () => {
  const router = new RandCapabilityRouter()
  await assert.rejects(
    () => router.invoke('storage.write'),
    (error) => error instanceof CapabilityRoutingError && error.code === 'CAPABILITY_UNAVAILABLE',
  )
})

test('execution fallback is disabled by default for protected writes', async () => {
  const calls = []
  const router = new RandCapabilityRouter()
  router.register({
    id: 'first',
    capabilities: ['operational.action'],
    priority: 10,
    execute: async () => {
      calls.push('first')
      const error = new Error('timeout after submit')
      error.code = 'TIMEOUT'
      throw error
    },
  })
  router.register({
    id: 'second',
    capabilities: ['operational.action'],
    priority: 20,
    execute: async () => { calls.push('second'); return 'duplicate-risk' },
  })

  await assert.rejects(() => router.invoke('operational.action'), /timeout after submit/)
  assert.deepEqual(calls, ['first'])
})

test('explicit safe retry can fall back to the next provider', async () => {
  const router = new RandCapabilityRouter()
  router.register({
    id: 'first',
    capabilities: ['read.search'],
    priority: 10,
    execute: async () => {
      const error = new Error('provider unavailable')
      error.code = 'CAPABILITY_PROVIDER_UNAVAILABLE'
      throw error
    },
  })
  router.register({
    id: 'second',
    capabilities: ['read.search'],
    priority: 20,
    execute: async () => 'ok',
  })

  const result = await router.invoke('read.search', {}, { allowExecutionFallback: true })
  assert.equal(result.value, 'ok')
  assert.equal(result.trace.providerId, 'second')
  assert.equal(result.trace.fallbackCount, 1)
})

test('health snapshot reports disabled providers as non healthy', async () => {
  const router = new RandCapabilityRouter()
  router.register({
    id: 'telegram',
    capabilities: ['notify.send'],
    isAvailable: () => false,
    execute: async () => null,
  })

  const [health] = await router.healthSnapshot()
  assert.equal(health.available, false)
  assert.equal(health.status, CapabilityProviderStatus.DISABLED)
})
