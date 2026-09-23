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

test('createTimedFetch aborts hung fetch calls', async () => {
  const { createTimedFetch } = await import('../src/async-timeout.js')
  const previousFetch = globalThis.fetch
  globalThis.fetch = (_input, init = {}) => new Promise((_resolve, reject) => {
    const signal = init.signal
    if (signal?.aborted) {
      reject(signal.reason || new DOMException('Aborted', 'AbortError'))
      return
    }
    signal?.addEventListener('abort', () => {
      reject(signal.reason || new DOMException('Aborted', 'AbortError'))
    }, { once: true })
  })
  try {
    const timedFetch = createTimedFetch(40)
    await assert.rejects(() => timedFetch('https://example.test/hang'), /AbortError|Network timeout|aborted/i)
  } finally {
    globalThis.fetch = previousFetch
  }
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

test('Shell isolates section failures with ViewErrorBoundary and named-export guards', () => {
  assert.match(boundary, /export class ViewErrorBoundary/)
  assert.match(boundary, /data-testid="view-error"/)
  assert.match(shell, /ViewErrorBoundary viewId=/)
  assert.match(shell, /if \(!module\?\.TemperatureSensors\)/)
  assert.match(shell, /if \(!module\?\.Housekeeping\)/)
  assert.match(shell, /hotel-switch-loading/)
  assert.match(shell, /shellBootstrapped/)
  assert.match(shell, /ViewErrorBoundary viewId="notifications"/)
})

test('Home bounds operational queries and surfaces hard fetch failures', () => {
  const home = readFileSync(new URL('../src/randapp/Home.jsx', import.meta.url), 'utf8')
  assert.match(home, /HOME_QUERY_TIMEOUT_MS/)
  assert.match(home, /timed\(fetchIssues/)
  assert.match(home, /homeHardFail/)
  assert.match(home, /data-testid="home-retry"/)
  assert.match(app, /withTimeout\(loadDirectoryAll\(\)/)
})

test('Supabase client and list views abort hung network calls', () => {
  const supabase = readFileSync(new URL('../src/supabase.js', import.meta.url), 'utf8')
  const issues = readFileSync(new URL('../src/randapp/Issues.jsx', import.meta.url), 'utf8')
  const asyncTimeout = readFileSync(new URL('../src/async-timeout.js', import.meta.url), 'utf8')
  assert.match(asyncTimeout, /export function createTimedFetch/)
  assert.match(supabase, /createTimedFetch\(SUPABASE_FETCH_TIMEOUT_MS\)/)
  assert.match(supabase, /global:\s*\{\s*fetch:/)
  assert.match(issues, /withTimeout\(fetchIssues\(hotel\.id\), 45000/)
})
