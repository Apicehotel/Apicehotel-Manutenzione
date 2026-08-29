import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/offline-store.js', import.meta.url), 'utf8')
const ci = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8')
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

test('point23: outbox uses a persistent cross-tab Dexie drain lease', () => {
  assert.match(source, /db\.version\(4\)\.stores/)
  assert.match(source, /leases:\s*'&key,owner,expiresAt'/)
  assert.match(source, /DRAIN_OWNER\s*=\s*uuid\(\)/)
  assert.match(source, /DRAIN_LEASE_KEY\s*=\s*'outbox-drain'/)
  assert.match(source, /DRAIN_LEASE_MS\s*=\s*120000/)
  assert.match(source, /acquireDrainLease/)
  assert.match(source, /db\.leases\.add/)
  assert.match(source, /releaseDrainLease/)
})

test('point23: per-operation leases remain as crash and replay defense', () => {
  assert.match(source, /db\.transaction\('rw',\s*db\.outbox/)
  assert.match(source, /leaseOwner/)
  assert.match(source, /leaseUntil/)
  assert.match(source, /claimOutboxOperation/)
})

test('point23: mutations carry revisions so edits during an in-flight sync are not lost', () => {
  assert.match(source, /revision:\s*1/)
  assert.match(source, /nextRevision/)
  assert.match(source, /handleConcurrentMutation/)
  assert.match(source, /action:\s*'update',\s*targetId:\s*result\.id/)
})

test('point23: leases are released on retry and manual failure replay', () => {
  assert.match(source, /releaseClaim/)
  assert.match(source, /leaseOwner:\s*null,\s*leaseUntil:\s*0/)
  assert.match(source, /retryOfflineFailure/)
  assert.match(source, /nextAttemptAt:\s*0/)
})

test('point23: real browser chaos gate is part of CI', () => {
  assert.equal(pkg.scripts['test:chaos'], 'node test/offline-chaos.mjs')
  assert.match(ci, /Offline & chaos resilience gate/)
  assert.match(ci, /npm run test:chaos/)
  assert.match(ci, /CHAOS_BASE_URL:\s*http:\/\/127\.0\.0\.1:4174/)
})
