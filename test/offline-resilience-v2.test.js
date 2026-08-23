import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('offline store compacts repeated mutations and keeps blocked operations separate', async () => {
  const src = await read('../src/offline-store.js')
  assert.match(src, /db\.version\(3\)/)
  assert.match(src, /failures:/)
  assert.match(src, /async function compactMutation/)
  assert.match(src, /priorUpdates/)
  assert.match(src, /cancelledCreate/)
  assert.match(src, /BACKOFF_STEPS/)
  assert.match(src, /nextAttemptAt/)
  assert.match(src, /OFFLINE_CONFLICT/)
  assert.match(src, /getOfflineFailures/)
})

test('editable offline entities use mutation ids and server versions', async () => {
  const [issues, planned, urgents, sale] = await Promise.all([
    read('../src/issues-data.js'),
    read('../src/planned-data.js'),
    read('../src/urgents-data.js'),
    read('../src/sale-data.js'),
  ])
  for (const src of [issues, planned, urgents, sale]) {
    assert.match(src, /clientMutationId/)
    assert.match(src, /mutation_id/)
    assert.match(src, /updated_at/)
    assert.match(src, /_syncBaseUpdatedAt/)
    assert.match(src, /_syncBaseValues/)
    assert.match(src, /conflictError/)
    assert.match(src, /error\?\.code==='23505'/)
  }
})

test('create-only feedback is idempotent too', async () => {
  const feedback = await read('../src/feedback-data.js')
  assert.match(feedback, /clientMutationId/)
  assert.match(feedback, /mutation_id/)
  assert.match(feedback, /error\?\.code==='23505'/)
})

test('offline status surfaces blocked operations instead of retrying silently forever', async () => {
  const status = await read('../src/offline-status.js')
  const css = await read('../src/offline-status.css')
  assert.match(status, /blocked = 0/)
  assert.match(status, /richiede.*attenzione/)
  assert.match(css, /sync-blocked/)
})
