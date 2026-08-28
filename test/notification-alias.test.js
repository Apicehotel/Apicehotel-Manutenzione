import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { buildNotificationAlias, buildNotificationShortUrl, isValidNotificationCode, normalizeNotificationCode, parseNotificationAlias } from '../src/randapp/notification-alias.js'

const read=(path)=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

test('notification aliases are stable across the three hotels',()=>{
  assert.equal(buildNotificationAlias('hotelgio','urgent','191178'),'GIO-AV-191178')
  assert.equal(buildNotificationAlias('chocohotel','reminders','191178'),'CHO-PR-191178')
  assert.equal(buildNotificationAlias('brigantino','assignments','191178'),'BRI-IP-191178')
  assert.equal(buildNotificationAlias('hotelgio','housekeeping','191178'),'GIO-HK-191178')
})

test('notification aliases parse back to hotel channel and personal code',()=>{
  assert.deepEqual(parseNotificationAlias('gio-av-191178'),{alias:'GIO-AV-191178',hotelId:'hotelgio',channelId:'urgent',code:'191178'})
  assert.equal(parseNotificationAlias('GIO-XX-191178'),null)
  assert.equal(buildNotificationShortUrl('GIO-AV-191178','https://apicehotel.vercel.app'),'https://apicehotel.vercel.app/n/GIO-AV-191178')
})

test('notification code keeps exactly six numeric characters',()=>{
  assert.equal(normalizeNotificationCode('19a11-78'),'191178')
  assert.equal(isValidNotificationCode('000001'),true)
  assert.equal(isValidNotificationCode('19117'),false)
  assert.equal(isValidNotificationCode('19117A'),false)
})

test('database keeps the alias user-owned, unique and non-secret',()=>{
  const sql=read('supabase/migrations/20260828203000_user_notification_codes.sql')
  assert.match(sql,/code text not null unique/)
  assert.match(sql,/\^\[0-9\]\{6\}\$/)
  assert.match(sql,/auth_user_id = \(select auth\.uid\(\)\)/)
  assert.match(sql,/must never be used as authentication credentials or ntfy topics/)
})

test('short-link hardening auto-allocates aliases without turning them into credentials',()=>{
  const sql=read('supabase/migrations/20260828220000_notification_short_links.sql')
  assert.match(sql,/allocate_user_notification_code/)
  assert.match(sql,/profiles_notification_code_auto/)
  assert.match(sql,/191178/)
  assert.match(sql,/never an authentication credential and never an ntfy topic/)
})

test('profile and ntfy UI never render or copy the real topic as the normal identifier',()=>{
  const profile=read('src/randapp/Profile.jsx')
  const setup=read('src/randapp/ntfy/NtfySetup.jsx')
  const edge=read('supabase/functions/ntfy-config/index.ts')
  assert.match(profile,/Codice notifiche/)
  assert.match(profile,/saveOwnNotificationCode/)
  assert.match(setup,/channel\.alias\|\|buildNotificationAlias/)
  assert.doesNotMatch(setup,/>\{channel\.topic\}</)
  assert.doesNotMatch(setup,/clipboard\.writeText\(channel\.topic\)/)
  assert.match(setup,/buildNotificationShortUrl/)
  assert.match(edge,/aliasFor\(hotelId,"assignments",notificationCode\)/)
})
