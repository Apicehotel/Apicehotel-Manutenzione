import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const planned=fs.readFileSync(new URL('../src/planned-data.js',import.meta.url),'utf8')
const dispatcher=fs.readFileSync(new URL('../supabase/functions/assignment-notify/index.ts',import.meta.url),'utf8')
const ntfyConfig=fs.readFileSync(new URL('../supabase/functions/ntfy-config/index.ts',import.meta.url),'utf8')
const ntfyAlert=fs.readFileSync(new URL('../supabase/functions/ntfy-alert/index.ts',import.meta.url),'utf8')
const urgentWorker=fs.readFileSync(new URL('../supabase/functions/urgent-reminder-worker/index.ts',import.meta.url),'utf8')
const inboxData=fs.readFileSync(new URL('../src/randapp/notifications/notification-data.js',import.meta.url),'utf8')
const inboxUi=fs.readFileSync(new URL('../src/randapp/notifications/NotificationInbox.jsx',import.meta.url),'utf8')

test('interventions notify only newly added assignees',()=>{
  assert.match(planned,/notifyNewAssignees/)
  assert.match(planned,/previous=new Set\(assigneeIds\(previousAssignees\)\)/)
  assert.match(planned,/filter\(\(id\)=>!previous\.has\(id\)\)/)
  assert.match(planned,/functions\.invoke\('assignment-notify'/)
  assert.match(planned,/sectionOf\(item\)!==SECTION_INTERVENTION/)
  assert.match(planned,/await notifyNewAssignees\(created\)/)
  assert.match(planned,/await notifyNewAssignees\(updated,currentApp\?\.assignees\|\|\[\]\)/)
})

test('assignment dispatcher targets selected users and requires assign permission',()=>{
  assert.match(dispatcher,/role_permissions/)
  assert.match(dispatcher,/\.eq\("module","interventions"\)\.eq\("action","assign"\)/)
  assert.match(dispatcher,/if\(!assignPermission\?\.allowed\)return json\(\{ok:false,error:"forbidden"\},403\)/)
  assert.match(dispatcher,/push_subscriptions/)
  assert.match(dispatcher,/\.in\("utente",recipientIds\)/)
  assert.match(dispatcher,/personalTopic\(hotelId,rid\)/)
  assert.match(dispatcher,/channel:"push"/)
  assert.match(dispatcher,/channel:"ntfy"/)
  assert.match(dispatcher,/event_type:"assignment"/)
  assert.match(dispatcher,/intervention_id:interventionId/)
  assert.match(dispatcher,/assignedSet\.has\(id\)/)
})

test('dispatcher resolves legacy and auth ids to the same active hotel member',()=>{
  assert.match(dispatcher,/legacy_user_id/)
  assert.match(dispatcher,/authByAny\.set\(String\(profile\.legacy_user_id\),authId\)/)
  assert.match(dispatcher,/const normalize=/)
  assert.match(dispatcher,/memberAuthIds/)
  assert.match(dispatcher,/recipientIds=targets\.filter\(id=>allowed\.has\(id\)\)/)
})

test('assigned intervention also appears in the personal RandApp inbox for auth or legacy id',()=>{
  assert.match(inboxData,/user\?\.legacy_id/)
  assert.match(inboxData,/const ownIds = new Set/)
  assert.match(inboxData,/assigneeIds\(row\.assegnatari\)\.some\(\(id\) => ownIds\.has\(id\)\)/)
  assert.match(inboxData,/keyOf\('assignment', row\.id\)/)
  assert.match(inboxData,/title: 'Intervento assegnato'/)
  assert.match(inboxUi,/filter === 'assignment'/)
  assert.match(inboxUi,/>Interventi<\/button>/)
  assert.match(inboxUi,/type === 'assignment' \? 'wrench'/)
})

test('ntfy exposes and tests one private assignment channel per user',()=>{
  assert.match(ntfyConfig,/id:"assignments"/)
  assert.match(ntfyConfig,/Interventi assegnati a te/)
  assert.match(ntfyConfig,/personalTopic\(hotelId,userData\.user\.id\)/)
  assert.match(ntfyAlert,/channel==="assignments"/)
  assert.match(ntfyAlert,/TEST Interventi/)
})

test('ntfy priority 5 is reserved for genuine urgent alerts',()=>{
  assert.match(ntfyAlert,/const priority=test\?3:assignments\?4:reminders\?3:housekeeping\?3:5/)
  assert.match(ntfyAlert,/status:"sent".*test,channel,priority/)
  assert.match(urgentWorker,/priority:5/)
  assert.match(urgentWorker,/tags:\["rotating_light","warning"\]/)
  assert.match(dispatcher,/priority:4/)
})

test('notification failure never rolls back the saved intervention',()=>{
  assert.match(planned,/catch\(error\)\{console\.warn\('Notifica assegnazione non consegnata'/)
})
