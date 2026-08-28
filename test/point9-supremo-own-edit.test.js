import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const migration = read('supabase/migrations/20260828101500_supremo_own_issue_edit.sql')
const issues = read('src/randapp/Issues.jsx')
const permissions = read('src/permissions.js')

test('Supremo remains non-admin and does not receive generic edit permission', () => {
  assert.match(permissions, /if\(role==='Supremo'\)return \['view','create'\]\.includes\(action\)/)
  assert.match(migration, /role = 'Supremo'/)
  assert.match(migration, /created_by_user_id = \(select auth\.uid\(\)\)/)
  assert.doesNotMatch(migration, /set allowed\s*=\s*true[\s\S]*action\s*=\s*'edit'/i)
})

test('Supremo can edit only details of maintenance issues he created', () => {
  assert.match(migration, /add column if not exists created_by_user_id uuid/)
  assert.match(migration, /new\.created_by_user_id := old\.created_by_user_id/)
  assert.match(migration, /Supremo può modificare soltanto le manutenzioni create da lui/)
  assert.match(migration, /array\['camera','urgenza','categoria','stato_camera','note','foto_prima','updated_at','created_by_user_id'\]/)
  assert.match(issues, /isOwnSupremoIssue/)
  assert.match(issues, /Boolean\(issue\.createdByUserId\)/)
  assert.match(issues, /issue\.createdByUserId === currentAuthUserId/)
  assert.match(issues, /createdByUserId: user\?\.auth_user_id \|\| user\?\.id \|\| undefined/)
  assert.doesNotMatch(issues, /issue\.createdByName === user\?\.name/)
  assert.doesNotMatch(issues, /currentAuthUserId = user\?\.auth_user_id \|\| user\?\.legacy_id/)
  assert.match(issues, /Salva modifiche/)
  assert.match(issues, /Stato, assegnazioni e completamento restano in sola lettura/)
})

test('Punto 9 hardening closes helper exposure and mutable search path warning', () => {
  assert.match(migration, /alter function public\.enforce_supremo_permission_rule\(\) set search_path = public/)
  assert.match(migration, /revoke execute on function public\.has_app_permission\(text,text,text\) from public, anon/)
})
