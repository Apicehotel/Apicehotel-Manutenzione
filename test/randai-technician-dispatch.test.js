import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const operations = await readFile(new URL('../src/randai/control/TechnicianOperationsConsole.jsx', import.meta.url), 'utf8')
const dispatchPortal = await readFile(new URL('../src/randapp/TechnicianDispatchPortal.jsx', import.meta.url), 'utf8')
const publicPortal = await readFile(new URL('../src/technician-portal.jsx', import.meta.url), 'utf8')
const techFn = await readFile(new URL('../supabase/functions/tech-portal/index.ts', import.meta.url), 'utf8')
const sendFn = await readFile(new URL('../supabase/functions/send-tecnico-whatsapp/index.ts', import.meta.url), 'utf8')
const migration = await readFile(new URL('../supabase/migrations/20260902014500_randai_point4_technician_dispatch.sql', import.meta.url), 'utf8')
const main = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8')

test('Point 4 exposes the internal technician center', () => {
  assert.match(main, /TechnicianDispatchPortal/)
  assert.match(main, /tecnici-esterni/)
  assert.match(dispatchPortal, /hotel_memberships/)
  assert.match(dispatchPortal, /ALLOWED_ROLES/)
})

test('authorization stays with Direzione, Centro Congressi and Reception', () => {
  assert.match(operations, /AUTHORITY_ROLES = new Set\(\['direzione', 'direttore centro congressi', 'reception'\]\)/)
  assert.match(operations, /technician_request_external/)
  assert.match(operations, /technician_authorize_external/)
  assert.match(operations, /technician_reject_external/)
})

test('technicians have many-to-many competencies and hotel scope', () => {
  assert.match(migration, /external_technician_competencies/)
  assert.match(migration, /technician_competencies/)
  assert.match(operations, /technician_set_competencies/)
  assert.match(operations, /technician_manage_directory/)
})

test('dispatch credentials are request scoped and stored as hashes', () => {
  assert.match(migration, /technician_dispatch_tokens/)
  assert.match(migration, /token_hash/)
  assert.match(migration, /dispatch_request_id/)
  assert.match(migration, /expires_at/)
  assert.match(techFn, /sha256\(raw\)/)
  assert.match(techFn, /\.eq\("token_hash", hash\)/)
})

test('external technician requests closure but cannot hard-close RandApp', () => {
  assert.match(techFn, /status: "awaiting_internal_close"/)
  assert.match(techFn, /completed_requested_at/)
  assert.match(techFn, /tecnico_completato: true/)
  assert.doesNotMatch(techFn, /segnalazioni"\)\.update\(\{[^}]*stato:\s*"done"/)
  assert.match(publicPortal, /conferma interna/i)
})

test('WhatsApp dispatch validates actor, request and hashed credential', () => {
  assert.match(sendFn, /auth\.getUser\(\)/)
  assert.match(sendFn, /authority\(membership\.role\)/)
  assert.match(sendFn, /dispatch_request_id/)
  assert.match(sendFn, /token_hash/)
  assert.match(sendFn, /access\.technician_id!==dispatch\.technician_id/)
  assert.match(sendFn, /template_not_approved/)
})

test('intervention activity is auditable', () => {
  assert.match(migration, /technician_intervention_events/)
  for (const event of ['opened', 'arrival_set', 'started', 'note', 'completion_requested']) assert.match(techFn, new RegExp(`event_type: "${event}"`))
})
