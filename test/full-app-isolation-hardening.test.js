import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const shell = fs.readFileSync(new URL('../src/randapp/Shell.jsx', import.meta.url), 'utf8')
const notifications = fs.readFileSync(new URL('../src/randapp/notifications/notification-data.js', import.meta.url), 'utf8')

test('Shell never falls back to another directory user when session user is missing', () => {
  assert.doesNotMatch(shell, /\|\|\s*rows\[0\]/)
  assert.match(shell, /setDirectoryState\(matchedUser \? 'ready' : 'unauthorized'\)/)
  assert.match(shell, /if \(directoryState !== 'ready' \|\| !user \|\| !hotel\) return false/)
})

test('Shell clears stale hotel identity before each directory reload', () => {
  assert.match(shell, /setUsers\(\[\]\)\s*\n\s*setUser\(null\)/)
  assert.match(shell, /setDirectoryState\('error'\)/)
  assert.doesNotMatch(shell, /hotelById\(session\.hotelId\) \|\|/)
})

test('notification read state is scoped to the authenticated user and hotel', () => {
  assert.match(notifications, /notification_reads'[\s\S]*?\.eq\('hotel_id', hotelId\)\.eq\('user_id', authUserId\)/)
})
