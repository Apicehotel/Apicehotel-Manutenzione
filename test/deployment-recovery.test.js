import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { canAttemptDeploymentRecovery, isDeploymentAssetError } from '../src/deployment-recovery.js'

const main = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8')
const app = readFileSync(new URL('../src/randapp/App.jsx', import.meta.url), 'utf8')
const usersData = readFileSync(new URL('../src/users-data.js', import.meta.url), 'utf8')
const offlineStore = readFileSync(new URL('../src/offline-store.js', import.meta.url), 'utf8')
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

test('deployment recovery never performs destructive cache recovery while browser is offline', () => {
  assert.equal(canAttemptDeploymentRecovery(false), false)
  assert.equal(canAttemptDeploymentRecovery(true), true)
})

test('offline bootstrap keeps the last validated access and pre-offline directory data', () => {
  assert.match(app, /!navigator\.onLine/)
  assert.match(app, /isOfflineSessionFresh\(session\)/)
  assert.match(usersData, /getCachedCollection\('directory', hotelId\)/)
  assert.match(usersData, /offline:\s*true/)
  assert.match(offlineStore, /new Dexie\('apiceOffline'\)/)
  assert.match(offlineStore, /cache:'&key,entity,hotelId,updatedAt'/)
})

test('core RandApp remains modular and lazy within the bootstrap bundle budget', () => {
  assert.match(main, /lazy\(\(\) => import\(['"]\.\/randapp\/App\.jsx['"]\)\)/)
  assert.match(main, /lazy\(\(\) => import\(['"]\.\/randai\/RandAIAssistant\.jsx['"]\)\)/)
})

test('deployment recovery is installed before lazy runtime routes can load', () => {
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

test('service worker refuses invalid stale assets and bridges one previous release cache', () => {
  assert.match(serviceWorker, /apicehotel-manutenzione-v15/)
  assert.match(serviceWorker, /PURGE_RUNTIME_CACHES/)
  assert.match(serviceWorker, /isValidDynamicAsset/)
  assert.match(serviceWorker, /getPreviousAppCache/)
  assert.match(serviceWorker, /key !== previousCache/)
  assert.match(serviceWorker, /offlineNavigationResponse/)
  assert.match(serviceWorker, /offlineAssetResponse/)
  assert.match(serviceWorker, /status:\s*503/)
  assert.match(serviceWorker, /Cache-Control.*no-store/)
})

test('deployment caching keeps HTML fresh and hashed assets immutable', () => {
  assert.match(vercel, /public, max-age=31536000, immutable/)
  assert.match(vercel, /no-cache, no-store, must-revalidate/)
  assert.match(vercel, /"source": "\/assets\/\(\.\*\)"/)
  assert.match(vercel, /"source": "\/sw\.js"/)
})
