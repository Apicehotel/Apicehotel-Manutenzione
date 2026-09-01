import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { OFFLINE_BACKOFF_STEPS, retryDelay } from '../src/reliability/offline-concurrency.js'

test('offline-store retries sync on reconnect, focus, visibility and periodically', async () => {
  const source = await readFile(new URL('../src/offline-store.js', import.meta.url), 'utf8')
  assert.match(source, /window\.addEventListener\('online', \(\) => scheduleDrain\(0\)\)/)
  assert.match(source, /window\.addEventListener\('focus', \(\) => \{ if \(onlineNow\(\)\) scheduleDrain\(0\) \}\)/)
  assert.match(source, /document\?\.addEventListener\?\.\('visibilitychange'/)
  assert.match(source, /document\.visibilityState === 'visible'/)
  assert.match(source, /setInterval\(async \(\) => \{/)
  assert.match(source, /status\?\.pending && onlineNow\(\)\) scheduleDrain\(0\)/)
  assert.match(source, /}, 15000\)/)
})

test('retry keeps the established bounded backoff and adds jitter', () => {
  assert.deepEqual([...OFFLINE_BACKOFF_STEPS], [5000, 15000, 30000, 60000, 120000, 300000])
  assert.equal(retryDelay(0, () => 0), 4000)
  assert.equal(retryDelay(0, () => 0.5), 5000)
  assert.equal(retryDelay(0, () => 1), 6000)
  assert.equal(retryDelay(99, () => 0.5), 300000)
})
