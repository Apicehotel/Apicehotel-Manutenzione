import test from 'node:test'
import assert from 'node:assert/strict'
import {
  FUTURE_JWT_RE,
  humanizeJwtClockError,
  isFutureJwtError,
  JWT_CLOCK_USER_MESSAGE,
  readJwtIat,
  settleFreshAccessToken,
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
