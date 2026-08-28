import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { sanitizeDraft } from '../src/draft-store.js'

const source = async (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('point 6: drafts never persist large photo payloads', () => {
  const clean = sanitizeDraft({ title: 'rubinetto', photoData: 'data:image/jpeg;base64,AAA', completionPhotoData: 'AAA', draft: { title: 'x', photoData: 'BIG' } })
  assert.equal(clean.title, 'rubinetto')
  assert.equal(clean.photoData, undefined)
  assert.equal(clean.completionPhotoData, undefined)
  assert.equal(clean.draft.photoData, undefined)
})

test('point 6: issue and planned-work forms keep recoverable drafts and surface errors', async () => {
  const [issues, planned] = await Promise.all([source('src/randapp/Issues.jsx'), source('src/randapp/PlannedCreateSheet.jsx')])
  for (const code of [issues, planned]) {
    assert.match(code, /loadDraft\(/)
    assert.match(code, /saveDraft\(/)
    assert.match(code, /clearDraft\(/)
    assert.match(code, /operationFailed\(/)
    assert.match(code, /draftOwner/)
  }
  assert.match(issues, /issue-save-error/)
  assert.match(issues, /setDraft\(\{ location: '', title: ''/)
  assert.match(planned, /setLocation\(saved\?\.location/)
  assert.match(planned, /La bozza resta sul dispositivo/)
})

test('point 6: stale sessions are revalidated on startup and reconnect without logging out on transport errors', async () => {
  const app = await source('src/randapp/App.jsx')
  assert.match(app, /validateSupabaseSession/)
  assert.match(app, /window\.addEventListener\('online', validate\)/)
  assert.match(app, /if \(active && !result\.valid\)/)
  assert.match(app, /Controllo sessione rimandato/)
})

test('point 6: offline queue has bounded backoff, permanent-failure quarantine and conflict protection', async () => {
  const offline = await source('src/offline-store.js')
  assert.match(offline, /BACKOFF_STEPS/)
  assert.match(offline, /moveToFailures/)
  assert.match(offline, /OFFLINE_CONFLICT/)
  assert.match(offline, /clientMutationId/)
  assert.match(offline, /window\.addEventListener\('online'/)
})

test('point 6: render crashes offer retry and reload recovery', async () => {
  const boundary = await source('src/error-boundary.jsx')
  assert.match(boundary, /this\.setState\(\{ error: null \}\)/)
  assert.match(boundary, /Riprova/)
  assert.match(boundary, /Ricarica l'app/)
})
