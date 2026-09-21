import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const vercel = readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')
const sw = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8')
const pwa = readFileSync(new URL('../src/pwa.js', import.meta.url), 'utf8')
const e2e = readFileSync(new URL('../test/e2e.mjs', import.meta.url), 'utf8')
const ocean = readFileSync(new URL('../.github/workflows/digitalocean-preview.yml', import.meta.url), 'utf8')

test('SPA rewrite excludes immutable/static asset namespaces', () => {
  assert.ok(vercel.includes('(?!assets/'))
  assert.ok(vercel.includes('icons/'))
  assert.ok(vercel.includes('logos/'))
  assert.ok(vercel.includes('manifest\\\\.webmanifest'))
  assert.ok(vercel.includes('sw\\\\.js'))
})

test('service worker validates MIME before caching dynamic assets', () => {
  assert.match(sw, /isValidDynamicAsset/) 
  assert.match(sw, /isImmutableAsset/)
  assert.match(sw, /content-type/)
  assert.match(sw, /javascript/)
  assert.match(sw, /text\/css/)
  assert.match(sw, /CACHE_NAME = 'apicehotel-manutenzione-v15'/)
  assert.match(sw, /PURGE_RUNTIME_CACHES/)
  assert.match(sw, /Deployment asset no longer available/)
  assert.match(sw, /status:\s*503/)
})

test('Vercel Git deploys remain enabled after reviewed merges', () => {
  const config = JSON.parse(vercel)
  assert.equal(config.git?.deploymentEnabled, true)
})

test('Ocean preview waits for javascript SW before browser gates', () => {
  assert.match(ocean, /Wait for Ocean preview service worker/)
  assert.match(ocean, /sw\.js/)
  assert.match(ocean, /javascript|ecmascript/)
  assert.match(pwa, /console\.warn\('Registrazione PWA non riuscita'/)
  assert.doesNotMatch(pwa, /console\.error\('Registrazione PWA non riuscita'/)
  assert.match(e2e, /Registrazione PWA non riuscita/)
  assert.match(e2e, /Failed to update a ServiceWorker/)
})
