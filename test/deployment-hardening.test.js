import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const vercel = readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')
const sw = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8')

test('SPA rewrite excludes immutable/static asset namespaces', () => {
  assert.ok(vercel.includes('(?!assets/'))
  assert.ok(vercel.includes('icons/'))
  assert.ok(vercel.includes('logos/'))
  assert.ok(vercel.includes('manifest\\\\.webmanifest'))
  assert.ok(vercel.includes('sw\\\\.js'))
})

test('service worker validates MIME before caching dynamic assets', () => {
  assert.match(sw, /isValidDynamicAsset/)
  assert.match(sw, /content-type/)
  assert.match(sw, /javascript/)
  assert.match(sw, /text\/css/)
  assert.match(sw, /CACHE_NAME = 'apicehotel-manutenzione-v14'/)
  assert.match(sw, /PURGE_RUNTIME_CACHES/)
  assert.match(sw, /Deployment asset no longer available/)
  assert.match(sw, /status:\s*503/)
})
