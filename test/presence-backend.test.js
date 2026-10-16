import test from 'node:test'
import assert from 'node:assert/strict'
import { handlePresence } from '../supabase/functions/presence-status/handler.js'
import fs from 'node:fs'
import vm from 'node:vm'
import { transformSync } from 'esbuild'

const NOW = Date.parse('2026-10-16T08:00:00Z')
const row = { id: 'legacy-self', nome: 'Operatore', ruolo: 'manutentore', in_struttura: false, in_struttura_dal: null, in_struttura_hotel_id: null }
function setup(options = {}) {
  const calls = [], logs = []
  const tx = async (strings, ...values) => {
    const query = strings.join('?').replace(/\s+/g, ' ').trim()
    calls.push({ query, values })
    if (options.databaseError) throw new Error('private database details')
    if (query.includes('from public.profiles')) return options.missing ? [] : [{ ...row, ...options.row }]
    if (query.includes('from public.hotel_memberships')) return options.member === null ? [] : [{ role: options.member || 'manutentore' }]
    if (query.startsWith('update public.utenti')) {
      if (options.updateError) throw new Error('private write error')
      return []
    }
    throw new Error(`Unexpected SQL ${query}`)
  }
  const deps = { sql: { begin: async fn => fn(tx) }, authenticate: async token => { assert.equal(token, 'Bearer valid-user'); if (options.authError) throw new Error('Auth down'); return options.unauthenticated ? null : 'auth-self' }, now: () => NOW, log: { error: message => logs.push(message) } }
  return { calls, logs, async send(body = {}, headers = { authorization: 'Bearer valid-user' }) {
    const response = await handlePresence(new Request('https://example.test/presence', { method: 'POST', headers, body: JSON.stringify(body) }), deps)
    return { status: response.status, data: await response.json() }
  } }
}

test('presence status joins only the authenticated active profile and legacy row', async () => {
  const app = setup()
  const result = await app.send({ auth_user_id: 'someone-else' })
  assert.equal(result.status, 200)
  assert.equal(result.data.present, false)
  const query = app.calls[0]
  assert.deepEqual(query.values, ['auth-self'])
  assert.match(query.query, /p.active=true and u.active=true/)
  assert.match(query.query, /for update of u/)
})

test('missing bearer or rejected Auth cannot reach database', async () => {
  for (const headers of [{}, { authorization: 'not-a-bearer' }]) {
    const app = setup()
    assert.equal((await app.send({}, headers)).status, 401)
    assert.equal(app.calls.length, 0)
  }
  const app = setup({ unauthenticated: true })
  assert.equal((await app.send()).status, 401)
  assert.equal(app.calls.length, 0)
})

for (const failure of ['databaseError', 'authError', 'updateError']) {
  test(`${failure} returns service unavailable, never a missing profile or success`, async () => {
    const app = setup({ [failure]: true })
    const result = await app.send(failure === 'updateError' ? { action: 'set_presence', present: true, hotel_id: 'hotelgio' } : {})
    assert.equal(result.status, 503)
    assert.equal(result.data.ok, false)
    assert.doesNotMatch(JSON.stringify(result.data), /private|SQL|JWT|token/i)
    assert.deepEqual(app.logs, ['presence-status: dependency failure'])
  })
}

test('inactive or missing profile stays denied; ineligible legacy and hotel roles cannot write', async () => {
  for (const options of [{ missing: true }, { row: { ruolo: 'Reception' } }, { member: 'Reception' }, { member: null }]) {
    const app = setup(options)
    assert.equal((await app.send({ action: 'set_presence', present: true, hotel_id: 'hotelgio' })).status, 403)
    assert.equal(app.calls.some(call => call.query.startsWith('update')), false)
  }
})

test('entry verifies selected membership and updates one personal row', async () => {
  const app = setup({ row: { in_struttura: true, in_struttura_hotel_id: 'hotelgio', in_struttura_dal: new Date(NOW - 1000).toISOString() } })
  const result = await app.send({ action: 'set_presence', present: true, hotel_id: 'chocohotel', user_id: 'other' })
  assert.equal(result.status, 200)
  assert.equal(result.data.in_struttura_hotel_id, 'chocohotel')
  assert.equal(result.data.in_struttura, true)
  assert.deepEqual(app.calls[1].values, ['auth-self', 'chocohotel'])
  assert.match(app.calls[1].query, /active=true for share/)
  assert.deepEqual(app.calls[2].values, [true, new Date(NOW).toISOString(), 'app', 'chocohotel', 'legacy-self'])
  assert.equal(Date.parse(result.data.expires_at) - NOW, (7 * 60 + 20) * 60 * 1000)
})

test('checkout clears hotel and timestamp without accepting a client-provided user identity', async () => {
  const app = setup()
  const result = await app.send({ action: 'set_presence', present: false, hotel_id: 'other', user_id: 'other' })
  assert.equal(result.data.in_struttura, false)
  assert.equal(result.data.in_struttura_hotel_id, null)
  assert.equal(app.calls.length, 2)
  assert.deepEqual(app.calls[1].values, [false, null, null, null, 'legacy-self'])
})

test('expired or malformed presence is cleared under the same row lock', async () => {
  for (const since of ['invalid', new Date(NOW - (7 * 60 + 20) * 60 * 1000).toISOString()]) {
    const app = setup({ row: { in_struttura: true, in_struttura_dal: since, in_struttura_hotel_id: 'hotelgio' } })
    const result = await app.send()
    assert.equal(result.data.present, false)
    assert.equal(result.data.hotel_id, null)
    assert.equal(app.calls.length, 2)
  }
})

for (const body of [{ action: 'unknown' }, { action: 'set_presence', present: 'false' }, { action: 'set_presence', present: true, hotel_id: 'unknown' }]) {
  test(`malformed request is rejected before SQL: ${JSON.stringify(body)}`, async () => {
    const app = setup()
    assert.equal((await app.send(body)).status, 400)
    assert.equal(app.calls.length, 0)
  })
}

function requestModule(invoke) {
  const source = fs.readFileSync(new URL('../src/presence-request.js', import.meta.url), 'utf8')
  const module = { exports: {} }
  vm.runInNewContext(transformSync(source, { format: 'cjs' }).code, { module, exports: module.exports, require: () => ({ supabase: { functions: { invoke } } }) })
  return module.exports.requestPresence
}

test('client reads server error body instead of showing generic Edge Function error', async () => {
  const request = requestModule(async (name, { body }) => {
    assert.equal(name, 'presence-status')
    assert.equal(body.action, 'set_presence')
    return { error: { message: 'Edge Function returned a non-2xx status code', context: new Response(JSON.stringify({ error: 'Non abilitato per questa struttura' }), { status: 403 }) } }
  })
  await assert.rejects(request({ action: 'set_presence' }), /Non abilitato per questa struttura/)
})

test('client sanitizes JWT and non-JSON gateway failures', async () => {
  for (const response of [new Response('gateway unavailable', { status: 503 }), new Response(JSON.stringify({ error: 'Invalid JWT token' }), { status: 401 })]) {
    const request = requestModule(async () => ({ error: { context: response } }))
    await assert.rejects(request(), error => !/non-2xx|Invalid JWT|gateway unavailable/.test(error.message))
  }
})

test('presence database path uses direct Postgres and preserves Auth verification', () => {
  const source = fs.readFileSync(new URL('../supabase/functions/presence-status/index.ts', import.meta.url), 'utf8')
  assert.match(source, /npm:postgres@3\.4\.7/)
  assert.match(source, /SUPABASE_PUBLISHABLE_KEYS/)
  assert.match(source, /\/auth\/v1\/user/)
  assert.doesNotMatch(source, /\.from\(|SUPABASE_SERVICE_ROLE_KEY/)
})

 test('client never treats a legacy read-only endpoint as a confirmed write', async () => {
  const request = requestModule(async () => ({ data: { ok: true, present: false } }))
  await assert.rejects(request({ action: 'set_presence', present: true, hotel_id: 'hotelgio' }), /Nessuna modifica confermata/)
})
