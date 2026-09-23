import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { withTimeout } from '../src/async-timeout.js'
import { isDeploymentAssetError } from '../src/deployment-recovery.js'

const main = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8')
const app = readFileSync(new URL('../src/randapp/App.jsx', import.meta.url), 'utf8')
const shell = readFileSync(new URL('../src/randapp/Shell.jsx', import.meta.url), 'utf8')
const boundary = readFileSync(new URL('../src/error-boundary.jsx', import.meta.url), 'utf8')
const lazyRetry = readFileSync(new URL('../src/lazy-retry.js', import.meta.url), 'utf8')

test('withTimeout rejects hung promises so bootstrap cannot spin forever', async () => {
  await assert.rejects(
    () => withTimeout(new Promise(() => {}), 30, 'Directory struttura timeout'),
    /Directory struttura timeout/,
  )
  assert.equal(await withTimeout(Promise.resolve('ok'), 200, 'unused'), 'ok')
})

test('route and shell pages use retrying lazy imports for transient chunk failures', () => {
  assert.match(main, /lazyWithRetry\(\(\) => import\('\.\/randapp\/App\.jsx'\)\)/)
  assert.match(app, /lazyWithRetry\(\(\) => import\('\.\/Shell\.jsx'\)\)/)
  assert.match(shell, /lazyWithRetry\(\(\) => import\('\.\/Issues\.jsx'\)\)/)
  assert.match(shell, /TemperatureSensors/)
  assert.match(lazyRetry, /isDeploymentAssetError/)
  assert.match(lazyRetry, /retries/)
})

test('session and directory gates bound network waits and expose directory retry', () => {
  assert.match(app, /withTimeout\(validateSupabaseSession\(\)/)
  assert.match(app, /withTimeout\(fetchDirectory\(session\.hotelId\)/)
  assert.match(shell, /withTimeout\(fetchDirectory\(session\.hotelId\)/)
  assert.match(shell, /directoryRetry/)
  assert.match(shell, /data-testid="directory-retry"/)
})

test('error boundary Riprova reloads recoverable module failures instead of remounting a rejected lazy()', () => {
  assert.match(boundary, /handleRetry/)
  assert.match(boundary, /isRecoverableModuleError\(error\)/)
  assert.match(boundary, /window\.location\.reload\(\)/)
  assert.equal(isDeploymentAssetError(new Error('Failed to fetch dynamically imported module')), true)
})
