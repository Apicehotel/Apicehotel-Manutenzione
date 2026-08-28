import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read=(path)=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

test('short notification URLs are first-class RandApp routes',()=>{
  const main=read('src/main.jsx')
  const view=read('src/randapp/ntfy/NtfyShortLink.jsx')
  assert.match(main,/\/n\\\/\(\[\^\/\]\+\)/)
  assert.match(main,/NtfyShortLink/)
  assert.match(main,/ntfy_short/)
  assert.match(view,/parseNotificationAlias/)
  assert.match(view,/window\.location\.href=result\.deep_link/)
})

test('short-link resolver is authenticated, owner-bound and hotel-scoped',()=>{
  const edge=read('supabase/functions/ntfy-resolve/index.ts')
  assert.match(edge,/client\.auth\.getUser\(\)/)
  assert.match(edge,/user_notification_codes/)
  assert.match(edge,/\.eq\("auth_user_id",userData\.user\.id\)/)
  assert.match(edge,/alias_not_owned/)
  assert.match(edge,/hotel_memberships/)
  assert.match(edge,/membership\?\.active/)
  assert.match(edge,/topic_not_configured/)
})

test('real ntfy topic is resolved only after an explicit authorized action',()=>{
  const setup=read('src/randapp/ntfy/NtfySetup.jsx')
  const view=read('src/randapp/ntfy/NtfyShortLink.jsx')
  assert.doesNotMatch(setup,/clipboard\.writeText\(channel\.topic\)/)
  assert.match(view,/resolve\('open'\)/)
  assert.match(view,/resolve\('copy'\)/)
  assert.match(view,/Copia configurazione ntfy/)
})
