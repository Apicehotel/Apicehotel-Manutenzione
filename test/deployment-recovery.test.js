import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { isDeploymentAssetError } from '../src/deployment-recovery.js'

const main = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8')
const boundary = readFileSync(new URL('../src/error-boundary.jsx', import.meta.url), 'utf8')
const serviceWorker = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8')
const vercel = readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')

test('classifies stale deployment and Safari lazy-module failures without treating generic network failures as chunks', () => {
  const staleErrors = [
    'Importing a module script failed.',
    'Failed to fetch dynamically imported module: /assets/Shell-old.js',
    "'text/html' is not a valid JavaScript MIME type.",
    'ChunkLoadError: Loading chunk 42 failed',
    "undefined is not an object (evaluating 'v._result.default')",
    "Cannot destructure property 'TemperatureSensors' from null or undefined value",
  ]
  for (const message of staleErrors) assert.equal(isDeploymentAssetError(new Error(message)), true, message)
  assert.equal(isDeploymentAssetError(new Error('Failed to fetch /api/issues')), false)
  assert.equal(isDeploymentAssetError(new Error("Cannot destructure property 'unrelated' from null or undefined value")), false)
})

test('deployment recovery is installed before any lazy runtime route can load', () => {
  const installAt = main.indexOf('installDeploymentRecovery()')
  const lazyAt = main.indexOf('lazy(() => import(')
  assert.ok(installAt >= 0)
  assert.ok(lazyAt >= 0)
  assert.ok(installAt < lazyAt)
})

test('React render boundary delegates recoverable module failures to centralized recovery', () => {
  assert.match(boundary, /recoverFromDeploymentAssetError/)
  assert.match(boundary, /isDeploymentAssetError/)
  assert.doesNotMatch(boundary, /randapp-module-recovery:/)
})

test('service worker refuses invalid stale dynamic assets and supports runtime cache purge', () => {
  assert.match(serviceWorker, /apicehotel-manutenzione-v14/)
  assert.match(serviceWorker, /PURGE_RUNTIME_CACHES/)
  assert.match(serviceWorker, /isValidDynamicAsset/)
  assert.match(serviceWorker, /status:\s*503/)
  assert.match(serviceWorker, /Cache-Control.*no-store/)
})

test('deployment caching keeps HTML fresh and hashed assets immutable', () => {
  assert.match(vercel, /public, max-age=31536000, immutable/)
  assert.match(vercel, /no-cache, no-store, must-revalidate/)
  assert.match(vercel, /"source": "\/assets\/\(\.\*\)"/)
  assert.match(vercel, /"source": "\/sw\.js"/)
})
