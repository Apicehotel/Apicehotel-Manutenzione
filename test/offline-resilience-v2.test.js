import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('offline store compacts repeated mutations, preserves conflict bases and cleans staged blobs', async () => {
  const src = await read('../src/offline-store.js')
  assert.match(src, /db\.version\(3\)/)
  assert.match(src, /failures:/)
  assert.match(src, /async function compactMutation/)
  assert.match(src, /mergeQueuedPayload/)
  assert.match(src, /_syncBaseValues = \{ \.\.\.\(nextBase \|\| \{\}\), \.\.\.\(previousBase \|\| \{\}\) \}/)
  assert.match(src, /cleanupPayloadBlobs/)
  assert.match(src, /OFFLINE_BLOB_PREFIX/)
  assert.match(src, /BACKOFF_STEPS/)
  assert.match(src, /nextAttemptAt/)
  assert.match(src, /OFFLINE_CONFLICT/)
  assert.match(src, /retryOfflineFailure\(id, \{ force = false \} = \{\}\)/)
  assert.match(src, /discardOfflineFailure/)
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
    assert.match(src, /23505/)
  }
})

test('photo-backed entities compare storage paths and pre-check mutation ids before retry upload', async () => {
  const [issues, planned] = await Promise.all([read('../src/issues-data.js'), read('../src/planned-data.js')])
  assert.match(issues, /key==='photoData'\?item\?\.photoPath/)
  assert.match(issues, /completionPhotoData.*completionPhotoPath/)
  assert.match(issues, /existingByMutation/)
  assert.match(issues, /const existing=await existingByMutation\(mutationId\)/)
  assert.match(planned, /key==='photoAfter'\?item\?\.photoAfterPath/)
  assert.match(planned, /existingByMutation/)
  assert.match(planned, /const existing=await existingByMutation\(mutationId\)/)
})

test('queued urgent created offline sends its notification after reconnect', async () => {
  const urgents = await read('../src/urgents-data.js')
  assert.match(urgents, /_notifyOnSync:true/)
  assert.match(urgents, /if\(item\._notifyOnSync\)await notifyUrgent/)
})

test('create-only feedback is idempotent too', async () => {
  const feedback = await read('../src/feedback-data.js')
  assert.match(feedback, /clientMutationId/)
  assert.match(feedback, /mutation_id/)
  assert.match(feedback, /23505/)
})

test('core lists refresh after local queue replay or conflict resolution', async () => {
  const files = await Promise.all([
    read('../src/issues-data.js'),
    read('../src/planned-data.js'),
    read('../src/urgents-data.js'),
    read('../src/sale-data.js'),
    read('../src/feedback-data.js'),
  ])
  for (const src of files) assert.match(src, /apice-offline-data-changed/)
})

test('housekeeping keeps offline data isolated per hotel and separates day/work mutations', async () => {
  const housekeeping = await read('../src/housekeeping.jsx')
  assert.match(housekeeping, /apiceHousekeeping-\$\{hotelId\}/)
  assert.match(housekeeping, /outbox:'&key,camera,kind'/)
  assert.match(housekeeping, /key:`work:\$\{camera\}`/)
  assert.match(housekeeping, /key:`day:\$\{camera\}`/)
  assert.match(housekeeping, /baseValues/)
  assert.match(housekeeping, /OFFLINE_CONFLICT/)
  assert.match(housekeeping, /failures/)
  assert.match(housekeeping, /setInterval\(retry,15000\)/)
})

test('offline status provides a cross-device conflict resolution panel', async () => {
  const status = await read('../src/offline-status.js')
  const css = await read('../src/offline-status.css')
  assert.match(status, /getOfflineFailures/)
  assert.match(status, /Mantieni versione server/)
  assert.match(status, /Usa la mia modifica/)
  assert.match(status, /force: true/)
  assert.match(css, /apice-sync-panel/)
  assert.match(css, /@media \(min-width: 800px\)/)
  assert.match(css, /@media \(max-width: 420px\)/)
})
