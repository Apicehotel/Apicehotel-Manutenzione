import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const source=fs.readFileSync(new URL('../src/auth-data.js',import.meta.url),'utf8')
const verify=source.slice(source.indexOf('export async function validateSupabaseSession()'),source.indexOf('export async function signOutSupabase()'))
test('valid session is checked before trying a token rotation',()=>{
  assert.ok(verify.indexOf('auth.getUser()')>=0)
  assert.ok(verify.indexOf('auth.refreshSession()')>verify.indexOf('auth.getUser()'))
  assert.match(verify,/if \(!recoverable \|\| !session\.refresh_token\)/)
})
test('failure of refresh fails closed and successful refresh is verified',()=>{
  assert.match(verify,/if \(refreshError \|\| !refreshed\?\.session\) return \{ valid: false/)
  assert.match(verify,/const verified = await supabase\.auth\.getUser\(\)/)
})
test('PIN/session install settles REST acceptance and marks a login grace window',()=>{
  assert.match(source,/waitUntilRestAcceptsAccessToken/)
  assert.match(source,/apice-jwt-login-at/)
  assert.match(source,/export async function ensureRestAcceptsCurrentSession/)
  assert.match(source,/maxAttempts: 20/)
})
