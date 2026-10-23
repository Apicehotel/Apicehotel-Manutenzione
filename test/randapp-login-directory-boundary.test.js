import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const usersData = readFileSync(new URL('../src/users-data.js', import.meta.url), 'utf8')
const pinAuth = readFileSync(new URL('../supabase/functions/pin-auth/index.ts', import.meta.url), 'utf8')

test('PIN login directory is minimal, separately cached and excludes RandAI identities server-side', () => {
  assert.match(usersData, /function loginDirectoryUsers\(data, hotelId\)/)
  assert.match(usersData, /export async function fetchLoginDirectory\(hotelId, query = ''\)/)
  assert.match(usersData, /getCachedCollection\('login-directory', hotelId\)/)
  assert.match(usersData, /setCachedCollection\('login-directory', hotelId/)
  assert.match(pinAuth, /async function listLoginDirectory\(hotelId:string,query:string\)/)
  assert.match(pinAuth, /ruolo <> 'RandAI'/)
  assert.match(pinAuth, /\{id:String\(u\.id\),legacy_id:String\(u\.id\),name:u\.nome,hotel_id:hotelId,active:true\}/)
})

test('authenticated operational directory stays separate from the pre-login contract', () => {
  assert.match(usersData, /export async function fetchDirectory\(hotelId\)/)
  assert.match(usersData, /getCachedCollection\('directory', hotelId\)/)
  assert.match(pinAuth, /activeMember\(req,hotelId\)/)
  assert.match(pinAuth, /if\(member\)return json\(\{ok:true,users:await listOperationalDirectory\(hotelId\)\}\)/)
  assert.match(pinAuth, /users:await listLoginDirectory\(hotelId,query\)/)
})

test('unauthenticated PIN login directory is hotel-scoped, rate-limited and query-gated', () => {
  assert.match(pinAuth, /KNOWN_HOTELS/)
  assert.match(pinAuth, /allowLoginDirectory/)
  assert.match(pinAuth, /DIRECTORY_RATE_LIMIT\s*=\s*20/)
  assert.match(pinAuth, /LOGIN_DIRECTORY_MIN_QUERY\s*=\s*2/)
  assert.match(pinAuth, /Troppe richieste\. Riprova tra un minuto\./)
  assert.match(pinAuth, /hotel_id non valido/)
  assert.match(pinAuth, /query_required:\s*true/)
  // Authenticated callers skip the login-directory rate limit and query gate.
  assert.match(pinAuth, /if\(member\)return json\(\{ok:true,users:await listOperationalDirectory\(hotelId\)\}\)/)
})
