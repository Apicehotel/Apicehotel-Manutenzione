import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')

test('Cambia struttura mantiene la sessione Supabase', () => {
  const changeHotel = source.match(/const changeHotel\s*=\s*[^\n]+/u)?.[0] || ''
  assert.match(changeHotel, /setSwitchingHotel\(true\)/u)
  assert.doesNotMatch(changeHotel, /signOutSupabase|clearSession/u)
})

test('lo switch mostra solo strutture abilitate', () => {
  assert.match(source, /function HotelSwitcher\(/u)
  assert.match(source, /user\.hotels\.includes\(hotel\.id\)/u)
})

test('lo switch aggiorna hotelId senza cambiare userId', () => {
  assert.match(source, /const next = \{ \.\.\.session, hotelId: nextHotel\.id \}/u)
  assert.match(source, /saveSession\(next\)/u)
  assert.match(source, /setSession\(next\)/u)
})

test('il logout resta esplicito e chiude davvero Supabase', () => {
  const logout = source.match(/const logout\s*=\s*async[^\n]+/u)?.[0] || ''
  assert.match(logout, /signOutSupabase/u)
  assert.match(logout, /clearSession/u)
})
