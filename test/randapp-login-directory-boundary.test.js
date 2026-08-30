import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const usersData = readFileSync(new URL('../src/users-data.js', import.meta.url), 'utf8')

test('PIN directory filters non-login RandAI identities from network and offline cache', () => {
  assert.match(usersData, /function loginEligibleUsers\(data\)/)
  assert.match(usersData, /String\(user\.role \|\| ''\)\.trim\(\) !== 'RandAI'/)
  assert.match(usersData, /const users = loginEligibleUsers\(data\)/)
  assert.match(usersData, /loginEligibleUsers\(await getCachedCollection\('directory', hotelId\)\)/)
})
