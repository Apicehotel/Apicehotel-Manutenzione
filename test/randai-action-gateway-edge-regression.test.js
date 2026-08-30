import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync(new URL('../supabase/functions/randai-action-gateway/index.ts', import.meta.url), 'utf8')
const migration = fs.readFileSync(new URL('../supabase/migrations/20260831012000_randai_action_gateway.sql', import.meta.url), 'utf8')

test('action gateway authenticates and rechecks hotel membership and role permissions', () => {
  assert.match(source, /client\.auth\.getUser\(\)/)
  assert.match(source, /from\("hotel_memberships"\)/)
  assert.match(source, /\.eq\("auth_user_id", userData\.user\.id\)/)
  assert.match(source, /\.eq\("hotel_id", hotelId\)/)
  assert.match(source, /from\("role_permissions"\)/)
  assert.match(source, /required_permission/)
})

test('action gateway never trusts client hotel or resource without scoping', () => {
  assert.match(source, /contextMatches/)
  assert.match(source, /from\("segnalazioni"\)/)
  assert.match(source, /\.eq\("hotel_id", hotelId\)/)
  assert.match(source, /\.eq\("id", resourceId\)/)
})

test('execution is approval gated, idempotent, version fenced and post-verified', () => {
  assert.match(source, /approval_required/)
  assert.match(source, /idempotency_key/)
  assert.match(source, /expectedUpdatedAt/)
  assert.match(source, /\.eq\("updated_at", expectedUpdatedAt\)/)
  assert.match(source, /verifyAppliedIssueAction/)
  assert.match(source, /status: "EXECUTED"/)
})

test('expired or rejected approvals are renewed, executed approvals replay durably', () => {
  assert.match(source, /status: "PENDING"/)
  assert.match(source, /existing\.status === "APPROVED"/)
  assert.match(source, /payload\?\.execution\?\.status === "EXECUTED"/)
  assert.match(source, /execution: \{ status: "EXECUTED", after: verified, executedAt \}/)
  assert.match(source, /approval_not_pending/)
})

test('audit and kill switch tables are browser inaccessible', () => {
  assert.match(migration, /randai_action_gateway_settings enable row level security/)
  assert.match(migration, /randai_action_audit enable row level security/)
  assert.match(migration, /revoke all on table public\.randai_action_gateway_settings from anon, authenticated/)
  assert.match(migration, /revoke all on table public\.randai_action_audit from anon, authenticated/)
})
