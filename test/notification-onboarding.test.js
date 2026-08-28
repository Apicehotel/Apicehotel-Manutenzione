import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const onboarding=fs.readFileSync(new URL('../src/notification-onboarding.js',import.meta.url),'utf8')
const main=fs.readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8')
const ntfy=fs.readFileSync(new URL('../src/randapp/ntfy/NtfySetup.jsx',import.meta.url),'utf8')
const css=fs.readFileSync(new URL('../src/randapp/notification-onboarding.css',import.meta.url),'utf8')

test('global onboarding repairs existing push and asks only on user action',()=>{
  assert.match(onboarding,/repairPushSubscription\(hotelId\)/)
  assert.match(onboarding,/getPushSubscriptionState\(hotelId\)/)
  assert.match(onboarding,/subscribeToPush\(target\)/)
  assert.match(onboarding,/addEventListener\('click'/)
  assert.match(onboarding,/Notification\.permission==='granted'/)
})

test('onboarding handles iOS home-screen and denied permission states',()=>{
  assert.match(onboarding,/requiresHomeScreen/)
  assert.match(onboarding,/aggiungi RandApp alla schermata Home/)
  assert.match(onboarding,/state==='denied'/)
  assert.match(onboarding,/Riabilitale nelle impostazioni/)
})

test('assignment notification click routes to the right hotel and interventions',()=>{
  assert.match(onboarding,/notification'\)!=='assignment'/)
  assert.match(onboarding,/switch-hotel-\$\{targetHotel\}/)
  assert.match(onboarding,/nav-interventions/)
  assert.match(onboarding,/sidebar-interventions/)
  assert.match(onboarding,/drawer-interventions/)
  assert.match(onboarding,/type==='notification-click'/)
  assert.match(onboarding,/clearAssignmentParams\(\)/)
})

test('onboarding is initialized for the authenticated RandApp shell',()=>{
  assert.match(main,/initNotificationOnboarding/)
  assert.match(main,/notification-onboarding\.css/)
  assert.match(main,/initNotificationOnboarding\(\)/)
})

test('ntfy assignment channel is explicit and Android supports one-tap deep link',()=>{
  assert.match(ntfy,/interventi un canale personale privato/)
  assert.match(ntfy,/id === 'assignments' \? 'wrench'/)
  assert.match(ntfy,/ntfy:\/\//)
  assert.match(ntfy,/\?display=/)
  assert.match(ntfy,/>Apri<\/a>/)
  assert.match(ntfy,/Priorità \{channel\.priority \|\| 5\}/)
})

test('notification banner remains compact and mobile safe',()=>{
  assert.match(css,/position:fixed/)
  assert.match(css,/env\(safe-area-inset-bottom\)/)
  assert.match(css,/@media\(max-width:520px\)/)
  assert.match(css,/backdrop-filter/)
})
