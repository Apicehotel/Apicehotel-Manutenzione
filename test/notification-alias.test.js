import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { buildNotificationAlias, isValidNotificationCode, normalizeNotificationCode } from '../src/randapp/notification-alias.js'

const read=(path)=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

test('notification aliases are stable across the three hotels',()=>{
  assert.equal(buildNotificationAlias('hotelgio','urgent','482710'),'GIO-AV-482710')
  assert.equal(buildNotificationAlias('chocohotel','reminders','482710'),'CHO-PR-482710')
  assert.equal(buildNotificationAlias('brigantino','assignments','482710'),'BRI-IP-482710')
  assert.equal(buildNotificationAlias('hotelgio','housekeeping','482710'),'GIO-HK-482710')
})

test('notification code keeps exactly six numeric characters',()=>{
  assert.equal(normalizeNotificationCode('48a27-109'),'482710')
  assert.equal(isValidNotificationCode('000001'),true)
  assert.equal(isValidNotificationCode('48271'),false)
  assert.equal(isValidNotificationCode('48271A'),false)
})

test('database keeps the alias user-owned, unique and non-secret',()=>{
  const sql=read('supabase/migrations/20260828203000_user_notification_codes.sql')
  assert.match(sql,/code text not null unique/)
  assert.match(sql,/\^\[0-9\]\{6\}\$/)
  assert.match(sql,/auth_user_id = \(select auth\.uid\(\)\)/)
  assert.match(sql,/must never be used as authentication credentials or ntfy topics/)
})

test('profile and ntfy UI never render the real topic as the visible identifier',()=>{
  const profile=read('src/randapp/Profile.jsx')
  const setup=read('src/randapp/ntfy/NtfySetup.jsx')
  const edge=read('supabase/functions/ntfy-config/index.ts')
  assert.match(profile,/Codice notifiche/)
  assert.match(profile,/saveOwnNotificationCode/)
  assert.match(setup,/channel\.alias\|\|buildNotificationAlias/)
  assert.doesNotMatch(setup,/>\{channel\.topic\}</)
  assert.match(setup,/clipboard\.writeText\(channel\.topic\)/)
  assert.match(edge,/aliasFor\(hotelId,"assignments",notificationCode\)/)
})
