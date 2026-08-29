import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('roadmap21 separates RandAI management from RandApp admin', () => {
  const sql = read('supabase/migrations/20260829214635_roadmap21_split_randai_from_randapp_admin.sql')
  assert.match(sql, /m\.role <> 'RandAI'/)
  assert.match(sql, /can_manage_randai_hotel/)
  assert.match(sql, /m\.role = 'RandAI'/)
})

test('identity authority tables are browser read-only', () => {
  const sql = read('supabase/migrations/20260829222907_roadmap21_lock_identity_mutations_to_server_boundary.sql')
  for (const table of ['profiles', 'hotel_memberships', 'utenti']) {
    assert.match(sql, new RegExp(`revoke insert, update, delete, truncate, references, trigger on table public\\.${table} from authenticated`, 'i'))
    assert.match(sql, new RegExp(`grant select on table public\\.${table} to authenticated`, 'i'))
  }
})

test('self PIN change requires proof of the current PIN', () => {
  const source = read('supabase/functions/user-pin/index.ts')
  assert.match(source, /if \(!\/\^\\d\{4\}\$\/\.test\(currentPin\)\)/)
  assert.match(source, /bcrypt\.compare\(currentPin, cred\.pin_hash\)/)
  assert.doesNotMatch(source, /if \(currentPin\) \{/)
})

test('PIN recovery limiter is atomic and service-only', () => {
  const sql = read('supabase/migrations/20260829222950_roadmap21_atomic_pin_recovery_rate_limit.sql')
  const fn = read('supabase/functions/pin-recovery/index.ts')
  assert.match(sql, /for update/i)
  assert.match(sql, /revoke all on function public\.consume_pin_recovery_rate_limit.*authenticated/i)
  assert.match(sql, /grant execute on function public\.consume_pin_recovery_rate_limit.*service_role/i)
  assert.match(fn, /admin\.rpc\("consume_pin_recovery_rate_limit"/)
})

test('threat model records server-side authorization invariants', () => {
  const model = read('docs/RANDAPP_THREAT_MODEL.md')
  assert.match(model, /frontend visibility is never authorization/i)
  assert.match(model, /RandAI is not RandApp Admin/i)
  assert.match(model, /no hotel membership implies no hotel data/i)
})
