import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const authData = readFileSync(new URL('../src/auth-data.js', import.meta.url), 'utf8')
const app = readFileSync(new URL('../src/randapp/App.jsx', import.meta.url), 'utf8')

test('PIN login exposes the identity authenticated by pin-auth, not a stale client session user', () => {
  assert.match(authData, /const session = await setReturnedSession\(data\)/)
  assert.match(authData, /return \{ \.\.\.session, user: data\?\.user \|\| session\.user \}/)
})

test('RandApp persists the authenticated login identity into the app session', () => {
  assert.match(app, /const userId = auth\?\.user\?\.id \|\| user\.id/)
  assert.match(app, /onAuthenticated\(\{ user, userId, allowedHotels: hotels, workedHotel: hotelId \}\)/)
})
