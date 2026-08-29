import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const edge=fs.readFileSync('supabase/functions/randai-auth/index.ts','utf8')
const client=fs.readFileSync('src/randai/auth/randai-auth.js','utf8')
const gate=fs.readFileSync('src/randai/auth/RandAIProtectedRoute.jsx','utf8')

test('RandAI passwords are alphanumeric 6 to 12 only',()=>{
  assert.match(edge,/\^\[A-Za-z0-9\]\{6,12\}\$/)
  assert.match(client,/\^\[A-Za-z0-9\]\{6,12\}\$/)
  assert.match(gate,/replace\(\/\[\^A-Za-z0-9\]\\/g,''\)\.slice\(0,12\)/)
})

test('RandAI login uses separate edge function and Supabase session',()=>{
  assert.match(client,/functions\.invoke\('randai-auth'/)
  assert.match(client,/supabase\.auth\.setSession/)
  assert.match(edge,/action==="login"/)
  assert.match(edge,/randai_credentials/)
  assert.match(edge,/role!=="RandAI"/)
})

test('RandAI access management supports creation and password change',()=>{
  assert.match(edge,/action==="list_users"/)
  assert.match(edge,/action==="create_user"/)
  assert.match(edge,/action==="change_password"/)
  assert.match(gate,/Crea utente RandAI/)
  assert.match(gate,/La mia password/)
})
