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
  assert.match(view,/resolveNtfyShortLink\(parsed\.alias\)/)
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

test('authorized short link uses documented Android handoff and safe iOS copy fallback',()=>{
  const setup=read('src/randapp/ntfy/NtfySetup.jsx')
  const view=read('src/randapp/ntfy/NtfyShortLink.jsx')
  const edge=read('supabase/functions/ntfy-resolve/index.ts')
  assert.doesNotMatch(setup,/clipboard\.writeText\(channel\.topic\)/)
  assert.match(view,/const isIOS=/)
  assert.match(view,/await copyTopic\(result\.topic\)/)
  assert.match(view,/result\.app_link\|\|'https:\/\/ntfy\.sh\/app'/)
  assert.match(view,/if\(result\.subscription_link\)/)
  assert.match(view,/Copia topic ntfy/)
  assert.match(edge,/const subscriptionLink=`ntfy:\/\//)
  assert.match(edge,/subscription_link:subscriptionLink/)
  assert.doesNotMatch(edge,/apicehotel\.vercel\.app\/n\/\$\{alias\}/)
})
