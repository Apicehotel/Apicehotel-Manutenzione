import test from 'node:test'
import assert from 'node:assert/strict'
import { createJwtRecoveringFetch } from '../src/reliability/jwt-network-recovery.js'

const failed = () => new Response(JSON.stringify({ message: 'JWT issued at future' }), { status: 401 })
const ok = () => new Response('[]', { status: 200 })
const client = (refresh) => ({ auth: {
  getSession: async () => ({ data: { session: { refresh_token: 'refresh' } } }),
  refreshSession: refresh,
} })

test('future JWT GET refreshes and replaces stale Authorization only once', async () => {
  let attempts = 0, refreshes = 0
  const fetch = createJwtRecoveringFetch(async (_url, init) => {
    attempts++
    if (attempts === 1) return failed()
    assert.equal(new Headers(init.headers).get('authorization'), 'Bearer new.jwt')
    return ok()
  }, () => client(async () => { refreshes++; return { data: { session: { access_token: 'new.jwt' } } } }))
  const response = await fetch('https://example.test/rest/v1/segnalazioni', { headers: { Authorization: 'Bearer old.jwt' } })
  assert.equal(response.status, 200)
  assert.equal(attempts, 2)
  assert.equal(refreshes, 1)
})

test('writes are never replayed, even for a future JWT', async () => {
  let attempts = 0, refreshes = 0
  const fetch = createJwtRecoveringFetch(async () => { attempts++; return failed() }, () => client(async () => { refreshes++; return {} }))
  const response = await fetch('https://example.test/rest/v1/segnalazioni', { method: 'POST' })
  assert.equal(response.status, 401)
  assert.equal(attempts, 1)
  assert.equal(refreshes, 0)
})

test('unrelated errors, auth endpoints and functions are not retried', async () => {
  let attempts = 0
  const fetch = createJwtRecoveringFetch(async () => { attempts++; return failed() }, () => { throw Error('should not inspect auth') })
  await fetch('https://example.test/auth/v1/user')
  await fetch('https://example.test/functions/v1/pin-auth')
  assert.equal(attempts, 2)
})

test('invalid refresh fails closed and preserves the original error', async () => {
  let attempts = 0
  const fetch = createJwtRecoveringFetch(async () => { attempts++; return failed() }, () => client(async () => ({ error: new Error('Invalid Refresh Token') })))
  const response = await fetch('https://example.test/rest/v1/segnalazioni')
  assert.equal(response.status, 401)
  assert.equal(attempts, 1)
})

test('successful GET does not refresh', async () => {
  const fetch = createJwtRecoveringFetch(async () => ok(), () => { throw Error('no refresh expected') })
  assert.equal((await fetch('https://example.test/rest/v1/segnalazioni')).status, 200)
})
