import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  classifyDiagnostic,
  diagnosticReference,
  deriveDiagnosticStatus,
  enrichDiagnostic,
  userDiagnosticMessage,
} from '../src/diagnostic-taxonomy.js'

const client = fs.readFileSync(new URL('../src/diagnostics-client.js', import.meta.url), 'utf8')
const ui = fs.readFileSync(new URL('../src/randapp/admin/DiagnosticsTab.jsx', import.meta.url), 'utf8')

test('point 16 classifies common operational failures with actionable guidance', () => {
  const cases = [
    ['Load failed while saving', 'network'],
    ['row level security policy denied', 'permissions'],
    ['JWT expired session', 'auth'],
    ['offline sync conflict', 'offline-sync'],
    ['ntfy subscription failed', 'notifications'],
    ['XLS import parser error', 'import'],
    ['foreign key constraint', 'database'],
    ['Edge Function worker failed', 'backend'],
    ['TypeError while React render', 'app'],
  ]
  for (const [message, category] of cases) {
    const result = classifyDiagnostic({ message })
    assert.equal(result.category, category, message)
    assert.ok(result.guidance.length > 20)
  }
})

test('point 16 RAND references are stable, hotel-scoped and do not expose secrets', () => {
  const base = { hotel_id: 'hotelgio', kind: 'save', message: 'Load failed', route: '/issues' }
  const a = diagnosticReference(base)
  const b = diagnosticReference(base)
  const otherHotel = diagnosticReference({ ...base, hotel_id: 'chocohotel' })
  assert.match(a, /^RAND-[0-9A-F]{4}$/)
  assert.equal(a, b)
  assert.notEqual(a, otherHotel)
  const user = userDiagnosticMessage(new Error('Load failed'), base)
  assert.equal(user.reference, a)
  assert.doesNotMatch(JSON.stringify(user), /hotelgio|\/issues/)
})

test('point 16 diagnostic status distinguishes healthy, offline, blocked and backend degradation', () => {
  const healthy = deriveDiagnosticStatus({ snapshot: { platform: { online: true }, services: { offlineQueue: { value: { pending: 0, blocked: 0 } } }, localDiagnosticQueue: 0 }, operational: { status: 'ok' } })
  assert.equal(healthy.status, 'ok')
  const offline = deriveDiagnosticStatus({ snapshot: { platform: { online: false }, services: { offlineQueue: { value: { pending: 3, blocked: 0 } } } }, operational: { status: 'ok' } })
  assert.equal(offline.label, 'Operativa offline')
  const blocked = deriveDiagnosticStatus({ snapshot: { platform: { online: true }, services: { offlineQueue: { value: { pending: 0, blocked: 2 } } } }, operational: { status: 'ok' } })
  assert.equal(blocked.status, 'problem')
  const backend = deriveDiagnosticStatus({ snapshot: { platform: { online: true }, services: { offlineQueue: { value: { pending: 0, blocked: 0 } } } }, operational: { status: 'problem' } })
  assert.equal(backend.label, 'Degradata')
})

test('point 16 fetched events and incidents are enriched without changing diagnostic table schema', () => {
  assert.match(client, /map\(enrichDiagnostic\)/)
  assert.match(client, /enrichDiagnostic\(\{ \.\.\.row, hotel_id: row\.hotel_id \|\| hotelId \}\)/)
  assert.doesNotMatch(client, /category:\s*crop|reference:\s*crop/)
  const enriched = enrichDiagnostic({ hotel_id: 'brigantino', kind: 'window-error', message: 'TypeError', route: '/home' })
  assert.equal(enriched.category, 'app')
  assert.match(enriched.reference, /^RAND-/)
})

test('point 16 diagnostics exposes safe recovery instead of destructive reset actions', () => {
  assert.match(client, /export async function retryOfflineSync/)
  assert.match(client, /await drainOfflineQueue\(\)/)
  assert.match(ui, /Riprova sincronizzazione/)
  assert.match(ui, /Ripara push/)
  assert.match(ui, /Rimetti in coda/)
  assert.match(ui, /incident\.reference/)
  assert.match(ui, /event\.reference/)
  assert.match(ui, /categoryLabel/)
  assert.match(ui, /guidance/)
  assert.doesNotMatch(ui, /reset database|resetta database|truncate/i)
})
