import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const usersData = readFileSync(new URL('../src/users-data.js', import.meta.url), 'utf8')
const pinAuth = readFileSync(new URL('../supabase/functions/pin-auth/index.ts', import.meta.url), 'utf8')

test('PIN login directory is minimal, separately cached and excludes RandAI identities server-side', () => {
  assert.match(usersData, /function loginDirectoryUsers\(data, hotelId\)/)
  assert.match(usersData, /export async function fetchLoginDirectory\(hotelId\)/)
  assert.match(usersData, /getCachedCollection\('login-directory', hotelId\)/)
  assert.match(usersData, /setCachedCollection\('login-directory', hotelId, users\)/)
  assert.match(pinAuth, /async function listLoginDirectory\(hotelId:string\)/)
  assert.match(pinAuth, /\.neq\("ruolo","RandAI"\)/)
  assert.match(pinAuth, /\{id:u\.id,legacy_id:u\.id,name:u\.nome,hotel_id:hotelId,active:true\}/)
})

test('authenticated operational directory stays separate from the pre-login contract', () => {
  assert.match(usersData, /export async function fetchDirectory\(hotelId\)/)
  assert.match(usersData, /getCachedCollection\('directory', hotelId\)/)
  assert.match(pinAuth, /activeMember\(req,hotelId\)/)
  assert.match(pinAuth, /listOperationalDirectory\(hotelId\):listLoginDirectory\(hotelId\)/)
})
