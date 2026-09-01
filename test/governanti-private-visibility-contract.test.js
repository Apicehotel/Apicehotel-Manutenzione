import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync(new URL('../supabase/migrations/20260901130855_governanti_private_requests_and_phone_gate.sql', import.meta.url), 'utf8')

test('Governante and Capo Governante can read only their own maintenance issues', () => {
  assert.match(migration, /array\['Governante','Capo Governante'\]/)
  assert.match(migration, /created_by_user_id = \(select auth\.uid\(\)\)/)
  assert.match(migration, /current_profile_has_phone\(\)/)
})

test('Governanti without a personal phone cannot create maintenance issues', () => {
  assert.match(migration, /segnalazioni_permission_insert/)
  assert.match(migration, /or public\.current_profile_has_phone\(\)/)
})

test('Governanti see only supply requests created by their authenticated account', () => {
  assert.match(migration, /requested_by = \(select auth\.uid\(\)\)/)
  assert.match(migration, /r\.requested_by = \(select auth\.uid\(\)\)/)
})

test('supply request creation requires a personal phone for housekeeping roles', () => {
  assert.match(migration, /v_is_housekeeping := public\.has_hotel_role/)
  assert.match(migration, /raise exception 'PHONE_REQUIRED'/)
})

test('phone is only an eligibility gate: record ownership remains auth.uid', () => {
  assert.match(migration, /requested_by,requested_by_name/)
  assert.match(migration, /values\(p_hotel_id,auth\.uid\(\)/)
  assert.doesNotMatch(migration, /requested_by_phone|creator_phone|telefono.*=.*requested/)
})
