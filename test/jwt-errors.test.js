import test from 'node:test'
import assert from 'node:assert/strict'
import {
  FUTURE_JWT_RE,
  humanizeJwtClockError,
  isFutureJwtError,
  JWT_CLOCK_USER_MESSAGE,
  readJwtIat,
  settleFreshAccessToken,
  isJwtLoginGraceActive,
  waitUntilRestAcceptsAccessToken,
} from '../src/reliability/jwt-errors.js'

test('detects PostgREST future JWT and PGRST303 codes', () => {
  assert.equal(isFutureJwtError({ message: 'JWT issued at future' }), true)
  assert.equal(isFutureJwtError({ code: 'PGRST303' }), true)
  assert.equal(FUTURE_JWT_RE.test('JWT issued the future'), true)
  assert.equal(isFutureJwtError({ message: 'permission denied' }), false)
})

test('humanizes opaque JWT clock failures for Italian operators', () => {
  assert.equal(humanizeJwtClockError({ message: 'JWT issued at future' }), JWT_CLOCK_USER_MESSAGE)
  assert.equal(humanizeJwtClockError('network down'), null)
})

test('settleFreshAccessToken waits only for a capped local iat skew', async () => {
  const futureIat = Math.floor(Date.now() / 1000) + 3
  const token = `a.${Buffer.from(JSON.stringify({ iat: futureIat })).toString('base64url')}.b`
  assert.equal(readJwtIat(token), futureIat)
  let waited = 0
  const waitMs = await settleFreshAccessToken(token, async (ms) => { waited = ms })
  assert.ok(waitMs > 0)
  assert.ok(waited <= 8000)
  assert.equal(await settleFreshAccessToken('not-a-jwt', async () => { throw new Error('no wait') }), 0)
})

test('waitUntilRestAcceptsAccessToken retries until PostgREST stops rejecting future JWT', async () => {
  let calls = 0
  const ok = await waitUntilRestAcceptsAccessToken({
    accessToken: `a.${Buffer.from(JSON.stringify({ iat: Math.floor(Date.now() / 1000) - 10 })).toString('base64url')}.b`,
    restUrl: 'https://example.test',
    anonKey: 'anon',
    sleep: async () => {},
    fetchImpl: async () => {
      calls += 1
      if (calls < 3) return new Response(JSON.stringify({ message: 'JWT issued at future' }), { status: 401 })
      return new Response('[]', { status: 200 })
    },
  })
  assert.equal(ok, true)
  assert.equal(calls, 3)
})

test('login grace helper covers the two-minute post-PIN window', () => {
  const previous = globalThis.sessionStorage
  const store = new Map()
  globalThis.sessionStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => { store.set(key, String(value)) },
    removeItem: (key) => { store.delete(key) },
  }
  try {
    assert.equal(isJwtLoginGraceActive(), false)
    sessionStorage.setItem('apice-jwt-login-at', String(Date.now()))
    assert.equal(isJwtLoginGraceActive(), true)
  } finally {
    if (previous === undefined) delete globalThis.sessionStorage
    else globalThis.sessionStorage = previous
  }
})
