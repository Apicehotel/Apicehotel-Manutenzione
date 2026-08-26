import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('RandApp home filters urgent/intervention content by role capability', async () => {
  const home = await read('../src/randapp/Home.jsx')
  assert.match(home, /canViewUrgent\(user\)/)
  assert.match(home, /canViewPlanned\(user\)/)
  assert.match(home, /canViewHousekeeping\(user\)/)
  assert.match(home, /if \(permissions\.urgent\) requests\.push\(fetchUrgents/)
  assert.match(home, /if \(permissions\.interventions\) requests\.push\(fetchPlanned/)
  assert.match(home, /show: permissions\.urgent/)
  assert.match(home, /show: permissions\.interventions/)
  assert.match(home, /permissions\.housekeeping/)
})

test('global urgent alert does not subscribe for roles without urgent visibility', async () => {
  const alert = await read('../src/randapp/GlobalUrgentAlert.jsx')
  assert.match(alert, /const allowed = canViewUrgent\(user\)/)
  assert.match(alert, /if \(!allowed \|\| !hotel\?\.id\)/)
  assert.match(alert, /if \(!allowed\) \{/)
  assert.match(alert, /if \(!allowed \|\| hidden \|\| !visible\.length\) return null/)
})
