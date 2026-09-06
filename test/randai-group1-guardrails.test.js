import test from 'node:test'
import assert from 'node:assert/strict'
import {
  authorizeToolCall,
  createToolPolicyRegistry,
  listExposedTools,
} from '../src/randai/core/tool-gateway.js'
import { traceRandAIOperation } from '../src/randai/core/ai-observability.js'

const registry = createToolPolicyRegistry({
  'maintenance.read': {
    risk: 'LOW',
    scopes: ['maintenance:read'],
    hotelScoped: true,
    mutation: false,
    enabled: true,
  },
  'maintenance.write': {
    risk: 'HIGH',
    scopes: ['maintenance:write'],
    hotelScoped: true,
    mutation: true,
    enabled: true,
  },
  'dangerous.unapproved': {
    risk: 'CRITICAL',
    scopes: [],
    enabled: false,
  },
})

const actor = { id: 'tester' }

test('RandTool Gateway is fail-closed for unknown tools', () => {
  assert.equal(authorizeToolCall({
    toolName: 'unknown.tool',
    registry,
    actor,
    hotelId: 'gio',
    grantedScopes: ['*'],
  }).code, 'TOOL_NOT_REGISTERED')
})

test('RandTool Gateway denies disabled tools', () => {
  assert.equal(authorizeToolCall({
    toolName: 'dangerous.unapproved',
    registry,
    actor,
    hotelId: 'gio',
  }).code, 'TOOL_DISABLED')
})

test('RandTool Gateway denies cross-hotel calls', () => {
  assert.equal(authorizeToolCall({
    toolName: 'maintenance.read',
    registry,
    actor,
    hotelId: 'gio',
    targetHotelId: 'choco',
    grantedScopes: ['maintenance:read'],
  }).code, 'CROSS_HOTEL_DENIED')
})

test('RandTool Gateway requires all declared scopes', () => {
  assert.equal(authorizeToolCall({
    toolName: 'maintenance.write',
    registry,
    actor,
    hotelId: 'gio',
    grantedScopes: ['maintenance:read'],
  }).code, 'SCOPE_DENIED')
})

test('RandTool Gateway exposes only tools actually authorized', () => {
  assert.deepEqual(listExposedTools({
    registry,
    actor,
    hotelId: 'gio',
    grantedScopes: ['maintenance:read'],
  }), ['maintenance.read'])
})

test('RandAI observability wrapper is transparent when telemetry is disabled', async () => {
  const result = await traceRandAIOperation('test', { 'rand.test': true }, async () => 'ok')
  assert.equal(result, 'ok')
})

test('RandAI observability wrapper rethrows operation errors', async () => {
  await assert.rejects(
    traceRandAIOperation('test-error', {}, async () => {
      throw new Error('expected')
    }),
    /expected/,
  )
})
