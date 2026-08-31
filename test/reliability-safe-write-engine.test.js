import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  SafeWriteCode,
  SafeWriteError,
  createMutationId,
  safeWrite,
} from '../src/reliability/safe-write-engine.js'

test('safe write executes preflight before write and confirms persisted value', async () => {
  const order = []
  const result = await safeWrite({
    operation: 'test.create',
    preflight: () => { order.push('preflight') },
    write: async () => { order.push('write'); return { id: '1' } },
    readBack: async () => { order.push('readback'); return { id: '1', status: 'saved' } },
    verify: (value) => { order.push('verify'); return value.status === 'saved' },
  })
  assert.deepEqual(order, ['preflight', 'write', 'readback', 'verify'])
  assert.equal(result.value.id, '1')
})

test('safe write never retries a failed write implicitly', async () => {
  let writes = 0
  await assert.rejects(
    safeWrite({
      write: async () => { writes += 1; throw new Error('network') },
      readBack: async () => null,
    }),
    /network/,
  )
  assert.equal(writes, 1)
})

test('safe write can reuse an idempotency hit without writing again', async () => {
  let writes = 0
  const result = await safeWrite({
    idempotencyLookup: async () => ({ id: 'existing' }),
    write: async () => { writes += 1; return { id: 'new' } },
    readBack: async ({ writeResult }) => writeResult,
    verify: (value) => value.id === 'existing',
  })
  assert.equal(writes, 0)
  assert.equal(result.idempotencyHit, true)
})

test('safe write fails when transport success is not confirmed by read-back', async () => {
  await assert.rejects(
    safeWrite({ write: async () => ({ id: '1' }), readBack: async () => null }),
    (error) => error instanceof SafeWriteError && error.code === SafeWriteCode.NOT_CONFIRMED,
  )
})

test('safe write fails when persisted value does not verify', async () => {
  await assert.rejects(
    safeWrite({
      write: async () => ({ id: '1' }),
      readBack: async () => ({ id: '1', status: 'wrong' }),
      verify: () => false,
    }),
    (error) => error instanceof SafeWriteError && error.code === SafeWriteCode.VERIFY_FAILED,
  )
})

test('safe write verifies deletion by confirmed absence', async () => {
  const result = await safeWrite({
    expectation: 'absent',
    write: async () => ({ id: '1' }),
    readBack: async () => null,
  })
  assert.equal(result.ok, true)
})

test('mutation ids use an explicit namespace', () => {
  assert.match(createMutationId('RND-PLAN'), /^RND-PLAN-/)
})

test('planning writes are atomic, scoped, idempotent and read-back verified', () => {
  const planning = fs.readFileSync(new URL('../src/planning-work-data.js', import.meta.url), 'utf8')
  const migration = fs.readFileSync(new URL('../supabase/migrations/20260901003000_planning_work_safe_write.sql', import.meta.url), 'utf8')
  assert.match(planning, /safeWrite\(/)
  assert.match(planning, /rpc\('create_planning_work_safe'/)
  assert.match(planning, /p_mutation_id: stableMutationId/)
  assert.match(planning, /readPlanningJobSnapshot/)
  assert.match(planning, /\.eq\('hotel_id', hotelId\)/)
  assert.match(planning, /\.eq\('updated_at', expectedUpdatedAt\)/)
  assert.doesNotMatch(planning, /from\('planning_lavori'\)\s*\.insert/)
  assert.match(migration, /security invoker/i)
  assert.match(migration, /unique index if not exists planning_lavori_mutation_id_uidx/i)
  assert.match(migration, /insert into public\.planning_lavori_giorni[\s\S]*p_hotel_id/i)
  assert.match(migration, /auth\.uid\(\)/)
  assert.match(migration, /updated_at timestamptz not null default now\(\)/i)
})
