import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('offline-store retries sync on reconnect, focus, visibility and periodically', async () => {
  const source = await readFile(new URL('../src/offline-store.js', import.meta.url), 'utf8')
  assert.match(source, /window\.addEventListener\('online', tryDrain\)/)
  assert.match(source, /window\.addEventListener\('focus', tryDrain\)/)
  assert.match(source, /document\.addEventListener\('visibilitychange'/)
  assert.match(source, /document\.visibilityState === 'visible'/)
  assert.match(source, /setInterval\(async \(\) => \{/)
  assert.match(source, /if \(pending > 0\) drainOfflineQueue\(\)/)
  assert.match(source, /}, 15000\)/)
})
