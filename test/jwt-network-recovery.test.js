import test from 'node:test'
import assert from 'node:assert/strict'
import { createJwtRecoveringFetch } from '../src/reliability/jwt-network-recovery.js'

const failed = () => new Response(JSON.stringify({ message: 'JWT issued at future', code: 'PGRST303' }), { status: 401 })
const ok = () => new Response('[]', { status: 200 })
const sleep = async () => {}
const client = (refresh) => ({ auth: {
  getSession: async () => ({ data: { session: { refresh_token: 'refresh' } } }),
  refreshSession: refresh,
} })
// Token with iat already in the past so settleFreshAccessToken does not wait.
const pastToken = `hdr.${Buffer.from(JSON.stringify({ iat: Math.floor(Date.now() / 1000) - 30 })).toString('base64url')}.sig`

test('future JWT GET refreshes and replaces stale Authorization only once', async () => {
  let attempts = 0, refreshes = 0
  const fetch = createJwtRecoveringFetch(async (_url, init) => {
    attempts++
    if (attempts === 1) return failed()
    assert.equal(new Headers(init.headers).get('authorization'), `Bearer ${pastToken}`)
    return ok()
  }, () => client(async () => { refreshes++; return { data: { session: { access_token: pastToken } } } }), { sleep })
  const response = await fetch('https://example.test/rest/v1/segnalazioni', { headers: { Authorization: 'Bearer old.jwt' } })
  assert.equal(response.status, 200)
  assert.equal(attempts, 2)
  assert.equal(refreshes, 1)
})

test('future JWT GET retries once more after a short settle when skew persists', async () => {
  let attempts = 0, sleeps = 0
  const fetch = createJwtRecoveringFetch(async () => {
    attempts++
    return attempts < 3 ? failed() : ok()
  }, () => client(async () => ({ data: { session: { access_token: pastToken } } })), {
    sleep: async () => { sleeps++ },
  })
  const response = await fetch('https://example.test/rest/v1/segnalazioni')
  assert.equal(response.status, 200)
  assert.equal(attempts, 3)
  assert.ok(sleeps >= 1)
})

test('writes are never replayed, even for a future JWT', async () => {
  let attempts = 0, refreshes = 0
  const fetch = createJwtRecoveringFetch(async () => { attempts++; return failed() }, () => client(async () => { refreshes++; return {} }), { sleep })
  const response = await fetch('https://example.test/rest/v1/segnalazioni', { method: 'POST' })
  assert.equal(response.status, 401)
  assert.equal(attempts, 1)
  assert.equal(refreshes, 0)
})

test('unrelated errors, auth endpoints and functions are not retried', async () => {
  let attempts = 0
  let warned = 0
  const previousWindow = globalThis.window
  globalThis.window = { dispatchEvent: () => { warned++ } }
  try {
    const fetch = createJwtRecoveringFetch(async () => { attempts++; return failed() }, () => { throw Error('should not inspect auth') }, { sleep })
    await fetch('https://example.test/auth/v1/user')
    await fetch('https://example.test/functions/v1/pin-auth', { method: 'POST' })
    assert.equal(attempts, 2)
    assert.equal(warned, 0)
  } finally {
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
  }
})

test('invalid refresh fails closed and preserves the original error', async () => {
  let attempts = 0
  const fetch = createJwtRecoveringFetch(async () => { attempts++; return failed() }, () => client(async () => ({ error: new Error('Invalid Refresh Token') })), { sleep })
  const response = await fetch('https://example.test/rest/v1/segnalazioni')
  assert.equal(response.status, 401)
  assert.equal(attempts, 1)
})

test('successful GET does not refresh', async () => {
  const fetch = createJwtRecoveringFetch(async () => ok(), () => { throw Error('no refresh expected') }, { sleep })
  assert.equal((await fetch('https://example.test/rest/v1/segnalazioni')).status, 200)
})

test('login grace suppresses JWT rejection toasts', async () => {
  let warned = 0
  const previousWindow = globalThis.window
  const previousStorage = globalThis.sessionStorage
  const store = new Map([['apice-jwt-login-at', String(Date.now())]])
  globalThis.sessionStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => { store.set(key, String(value)) },
    removeItem: (key) => { store.delete(key) },
  }
  globalThis.window = { dispatchEvent: () => { warned++ } }
  try {
    const fetch = createJwtRecoveringFetch(async () => failed(), () => client(async () => ({ data: { session: { access_token: pastToken } } })), { sleep })
    await fetch('https://example.test/rest/v1/segnalazioni', { method: 'POST' })
    assert.equal(warned, 0)
  } finally {
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
    if (previousStorage === undefined) delete globalThis.sessionStorage
    else globalThis.sessionStorage = previousStorage
  }
})
