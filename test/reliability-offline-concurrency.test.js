import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  OFFLINE_LEASE_MS,
  canClaimOfflineOperation,
  createOfflineOperationId,
  retryDelay,
  withOfflineLease,
} from '../src/reliability/offline-concurrency.js'

const offlineStore = fs.readFileSync(new URL('../src/offline-store.js', import.meta.url), 'utf8')
const issuesData = fs.readFileSync(new URL('../src/issues-data.js', import.meta.url), 'utf8')
const migration = fs.readFileSync(new URL('../supabase/migrations/20260901024000_block39_issue_delete_cas.sql', import.meta.url), 'utf8')

test('offline operation ids use the shared RND-OP namespace', () => {
  assert.match(createOfflineOperationId(), /^RND-OP-/)
})

test('retry backoff is bounded and jittered around the configured step', () => {
  assert.equal(retryDelay(0, () => 0), 4000)
  assert.equal(retryDelay(0, () => 0.5), 5000)
  assert.equal(retryDelay(0, () => 1), 6000)
  assert.equal(retryDelay(99, () => 0.5), 300000)
})

test('cross-tab lease can be claimed only when due and not held by another owner', () => {
  const base = { id: 1, nextAttemptAt: 0, leaseOwner: null, leaseUntil: 0 }
  assert.equal(canClaimOfflineOperation(base, { ownerId: 'A', now: 1000 }), true)
  const leased = withOfflineLease(base, 'A', 1000)
  assert.equal(leased.leaseOwner, 'A')
  assert.equal(leased.leaseUntil, 1000 + OFFLINE_LEASE_MS)
  assert.equal(canClaimOfflineOperation(leased, { ownerId: 'B', now: 2000 }), false)
  assert.equal(canClaimOfflineOperation(leased, { ownerId: 'A', now: 2000 }), true)
  assert.equal(canClaimOfflineOperation(leased, { ownerId: 'B', now: leased.leaseUntil }), true)
  assert.equal(canClaimOfflineOperation({ ...base, nextAttemptAt: 5000 }, { ownerId: 'A', now: 4999 }), false)
})

test('Dexie v4 persists operation identity and lease metadata', () => {
  assert.match(offlineStore, /db\.version\(4\)/)
  assert.match(offlineStore, /&operationId/)
  assert.match(offlineStore, /leaseOwner/)
  assert.match(offlineStore, /leaseUntil/)
  assert.match(offlineStore, /claimOperation/)
  assert.match(offlineStore, /db\.transaction\('rw', db\.outbox/)
})

test('queue/cache and replay completion are atomic IndexedDB transactions', () => {
  assert.match(offlineStore, /db\.transaction\('rw', \[db\.outbox, db\.cache, db\.blobs\]/)
  assert.match(offlineStore, /db\.transaction\('rw', \[db\.outbox, db\.idmap, db\.cache\]/)
  assert.match(offlineStore, /db\.transaction\('rw', \[db\.failures, db\.outbox\]/)
})

test('issue cache preserves exact postgres version tokens for CAS', () => {
  assert.match(issuesData, /updatedAtToken:row\.updated_at\|\|null/)
  assert.match(issuesData, /_syncBaseVersion/)
  assert.match(issuesData, /query=query\.eq\('updated_at',changes\._syncBaseVersion\)/)
  assert.match(issuesData, /soft_delete_issue_cas/)
  assert.match(issuesData, /p_expected_updated_at:expected/)
})

test('delete CAS is atomic, hotel-scoped, permission-scoped and operation-correlated', () => {
  assert.match(migration, /for update/)
  assert.match(migration, /v_row\.updated_at is distinct from p_expected_updated_at/)
  assert.match(migration, /errcode = '40001'/)
  assert.match(migration, /p_operation_id !~ '\^RND-OP-'/)
  assert.match(migration, /has_app_permission\(p_hotel_id, 'issues', 'delete'\)/)
  assert.match(migration, /id = p_id and hotel_id = p_hotel_id/)
  assert.match(migration, /delete_operation_id = p_operation_id/)
})
