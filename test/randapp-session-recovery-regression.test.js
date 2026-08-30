import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const auth = readFileSync(new URL('../src/auth-data.js', import.meta.url), 'utf8')
const app = readFileSync(new URL('../src/randapp/App.jsx', import.meta.url), 'utf8')

test('PIN login preserves the authoritative identity returned by pin-auth', () => {
  assert.match(auth, /const session = await setReturnedSession\(data\)/)
  assert.match(auth, /return \{ \.\.\.session, user: data\?\.user \|\| session\.user \}/)
  assert.match(app, /const userId = auth\?\.user\?\.id \|\| user\.id/)
})

test('a stale app session is verified against the selected hotel before Shell mounts', () => {
  assert.match(app, /const \[sessionReady, setSessionReady\]/)
  assert.match(app, /const directory = await fetchDirectory\(session\.hotelId\)/)
  assert.match(app, /u\.auth_user_id === session\.userId \|\| u\.id === session\.userId \|\| u\.legacy_id === session\.userId/)
  assert.match(app, /await resetSession\(signOutSupabase\)/)
  assert.match(app, /if \(session && !sessionReady\) return <Spinner label="Verifico accesso…" \/>/)
})
