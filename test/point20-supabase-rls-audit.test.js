import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const perf = read('supabase/migrations/20260829215548_roadmap20_rls_performance_followup.sql')
const relational = read('supabase/migrations/20260829215654_roadmap20_randai_relational_isolation.sql')

test('point 20 optimizes utenti auth checks with initplans', () => {
  const optimized = perf.match(/hm\.auth_user_id\s*=\s*\(select auth\.uid\(\)\)/g) || []
  assert.ok(optimized.length >= 4)
  assert.doesNotMatch(perf, /hm\.auth_user_id\s*=\s*auth\.uid\(\)/)
})

test('point 20 consolidates RandAI permissive SELECT policies without weakening writes', () => {
  for (const table of ['documents', 'equipment', 'memory', 'procedures', 'sensor_bindings']) {
    assert.match(perf, new RegExp(`create policy randai_${table}_select`, 'i'))
    assert.match(perf, new RegExp(`create policy randai_${table}_insert`, 'i'))
    assert.match(perf, new RegExp(`create policy randai_${table}_update`, 'i'))
    assert.match(perf, new RegExp(`create policy randai_${table}_delete`, 'i'))
  }
  assert.match(perf, /status='approved' and public\.is_hotel_member\(hotel_id\)/)
  assert.match(perf, /active and public\.is_hotel_member\(hotel_id\)/)
  assert.match(perf, /public\.can_manage_randai_hotel\(hotel_id\)/)
})

test('point 20 enforces composite hotel integrity on RandAI parent-child relationships', () => {
  for (const signature of [
    'foreign key (equipment_id, hotel_id)',
    'foreign key (procedure_id, hotel_id)',
    'foreign key (document_id, hotel_id)',
  ]) assert.ok(relational.includes(signature))
  assert.match(relational, /references public\.randai_equipment \(id, hotel_id\)/)
  assert.match(relational, /references public\.randai_procedures \(id, hotel_id\)/)
  assert.match(relational, /references public\.randai_documents \(id, hotel_id\)/)
})
