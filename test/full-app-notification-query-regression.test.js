import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync(new URL('../src/randapp/notifications/notification-data.js', import.meta.url), 'utf8')

test('notification read query is scoped by hotel and authenticated user', () => {
  const compact = source.replace(/\s+/g, ' ')
  assert.match(compact, /notification_reads'\)\.select\('source_type,source_id,read_at'\)\.eq\('hotel_id', hotelId\)\.eq\('user_id', authUserId\)/)
})
