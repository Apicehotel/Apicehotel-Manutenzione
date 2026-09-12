import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const migration = fs.readFileSync(new URL('../supabase/migrations/20260912101500_randcore_security_definer_anon_hardening.sql', import.meta.url), 'utf8')

test('revokes anonymous execution from the five live SECURITY DEFINER findings', () => {
  const normalized = migration.replace(/\s+/g, ' ').toLowerCase()
  const signatures = [
    'eye_central_invoice_page(text, text, integer, integer, timestamptz)',
    'eye_central_review_page(text, text, integer, integer)',
    'eye_central_review_page(text, text, integer, integer, timestamptz)',
    'eye_central_review_upsert(text, text, jsonb)',
    'randguide_snapshot_procedure_internal()',
  ]

  for (const signature of signatures) {
    assert.ok(normalized.includes(`revoke execute on function public.${signature} from public, anon`), `missing anon revoke for ${signature}`)
  }
})

test('preserves authenticated EyeCentral RPC calls but keeps the trigger helper private', () => {
  assert.equal((migration.match(/grant execute on function public\.eye_central_/gi) ?? []).length, 4)
  assert.match(migration, /grant execute on function public\.eye_central_invoice_page\([\s\S]*?to authenticated/i)
  assert.match(migration, /grant execute on function public\.eye_central_review_page\(text, text, integer, integer\)[\s\S]*?to authenticated/i)
  assert.match(migration, /grant execute on function public\.eye_central_review_page\(text, text, integer, integer, timestamptz\)[\s\S]*?to authenticated/i)
  assert.match(migration, /grant execute on function public\.eye_central_review_upsert\(text, text, jsonb\)[\s\S]*?to authenticated/i)
  assert.doesNotMatch(migration, /grant execute on function public\.randguide_snapshot_procedure_internal/i)
})
